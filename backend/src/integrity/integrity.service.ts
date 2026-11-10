import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  createPublicKey,
  createVerify,
  sign,
  timingSafeEqual,
  verify,
  type JsonWebKey,
} from 'node:crypto';

export interface IntegrityVerdict {
  ok: boolean;
  reason?:
    | 'MISSING_TOKEN'
    | 'MALFORMED'
    | 'EXPIRED'
    | 'WRONG_PACKAGE'
    | 'DEVICE_NOT_TRUSTED'
    | 'APP_NOT_RECOGNIZED'
    | 'UNVERIFIED_SIGNATURE'
    | 'PROVIDER_UNAVAILABLE'
    | 'PROVIDER_REJECTED'
    | 'NONCE_MISMATCH';
  signatureVerified: boolean;
  provider?: 'hmac' | 'play_integrity' | 'apple_devicecheck' | 'apple_app_attest' | 'unsigned';
}

type ProviderResult = {
  verdict: IntegrityVerdict;
  /** Play Integrity decoded token payload (for audit/nonce checks). */
  payload?: Record<string, unknown>;
};

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PLAY_INTEGRITY_SCOPE = 'https://www.googleapis.com/auth/playintegrity';
const REQUEST_TIMEOUT_MS = 10_000;

function b64urlJson(part: string): unknown {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

function readStrings(v: unknown): string[] {
  if (Array.isArray(v))
    return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string') return [v];
  if (
    v &&
    typeof v === 'object' &&
    Array.isArray((v as { deviceVerdict?: unknown }).deviceVerdict)
  ) {
    return ((v as { deviceVerdict?: unknown }).deviceVerdict as unknown[]).filter(
      (x): x is string => typeof x === 'string',
    );
  }
  if (
    v &&
    typeof v === 'object' &&
    Array.isArray(
      (v as { deviceRecognitionVerdict?: unknown }).deviceRecognitionVerdict,
    )
  ) {
    return (
      (v as { deviceRecognitionVerdict?: unknown })
        .deviceRecognitionVerdict as unknown[]
    ).filter((x): x is string => typeof x === 'string');
  }
  return [];
}

function appRecognized(v: unknown): boolean {
  if (v === 'PLAY_RECOGNIZED') return true;
  if (Array.isArray(v)) return v.includes('PLAY_RECOGNIZED');
  if (v && typeof v === 'object') {
    const r = (v as { appRecognitionVerdict?: unknown }).appRecognitionVerdict;
    return (
      r === 'PLAY_RECOGNIZED' ||
      (Array.isArray(r) && r.includes('PLAY_RECOGNIZED'))
    );
  }
  return false;
}

@Injectable()
export class IntegrityService {
  private readonly logger = new Logger(IntegrityService.name);
  private readonly strict: boolean;
  private readonly androidPackage: string;
  private readonly iosBundle: string;
  private readonly verifySecret: string;
  private readonly allowUnverifiedClaims: boolean;
  private readonly isProduction: boolean;

  // Google Play Integrity (decodeIntegrityToken) config
  private readonly playEnabled: boolean;
  private readonly playProjectId: string;
  private readonly playClientEmail: string;
  private readonly playPrivateKey: string;
  private playAccessToken?: { value: string; expiresAt: number };

  // Apple App Attest / DeviceCheck config (JWS verification via Apple JWKS)
  private readonly appleJwksUrl: string;
  private appleJwks?: { keys: JsonWebKey[]; expiresAt: number };

  constructor(config: ConfigService) {
    this.isProduction =
      String(config.get('NODE_ENV', '')).toLowerCase() === 'production';
    const configured = config.get<string>('INTEGRITY_STRICT');
    if (configured === undefined) {
      this.strict = this.isProduction;
    } else {
      this.strict = configured.toLowerCase() === 'true';
      if (!this.strict && this.isProduction) {
        this.logger.warn(
          'INTEGRITY_STRICT=false in production: attendance accepts missing integrity tokens (pilot mode)',
        );
      }
    }
    // Empty/unconfigured package means "not enforced" except strict mode rejects
    // claimed tokens without a configured package (legacy pilot behavior).
    this.androidPackage = String(config.get('ANDROID_PACKAGE_NAME', ''));
    this.iosBundle = String(config.get('IOS_BUNDLE_ID', ''));
    this.verifySecret = String(config.get('INTEGRITY_TOKEN_SECRET', ''));
    this.allowUnverifiedClaims =
      String(
        config.get('INTEGRITY_ALLOW_UNVERIFIED_CLAIMS', ''),
      ).toLowerCase() === 'true' && !this.isProduction;
    if (this.allowUnverifiedClaims && this.isProduction) {
      this.logger.warn(
        'INTEGRITY_ALLOW_UNVERIFIED_CLAIMS is ignored in production',
      );
    }

    // Play Integrity: prefer explicit PLAY_INTEGRITY_* creds, fall back to FCM service account.
    this.playProjectId = String(
      config.get('PLAY_INTEGRITY_PROJECT_ID') ||
        config.get('FCM_PROJECT_ID') ||
        '',
    ).trim();
    this.playClientEmail = String(
      config.get('PLAY_INTEGRITY_CLIENT_EMAIL') ||
        config.get('FCM_CLIENT_EMAIL') ||
        '',
    ).trim();
    this.playPrivateKey = String(
      config.get('PLAY_INTEGRITY_PRIVATE_KEY') ||
        config.get('FCM_PRIVATE_KEY') ||
        '',
    ).replace(/\\n/g, '\n');
    const playExplicit = String(
      config.get('PLAY_INTEGRITY_ENABLED', ''),
    ).toLowerCase();
    if (playExplicit === 'false') {
      this.playEnabled = false;
    } else if (playExplicit === 'true') {
      this.playEnabled = Boolean(
        this.playProjectId && this.playClientEmail && this.playPrivateKey,
      );
    } else {
      // Auto-enable when credentials are present.
      this.playEnabled = Boolean(
        this.playProjectId && this.playClientEmail && this.playPrivateKey,
      );
    }

    // Apple: JWKS URL for provider-issued JWS (e.g. DeviceCheck/App Attest receipts) if used.
    this.appleJwksUrl = String(
      config.get(
        'APPLE_ATTEST_JWKS_URL',
        'https://appleid.apple.com/auth/keys',
      ),
    ).trim();
  }

  get strictMode(): boolean {
    return this.strict;
  }

  /**
   * Verify an integrity token (sync path, HMAC/unsigned/custom-claim tokens).
   * Provider API verifications (Play Integrity decode, Apple JWKS JWS) are
   * async; use verifyAsync/resolveSignalAsync for full provider coverage.
   */
  verify(token: string, platform: string): IntegrityVerdict {
    if (!token)
      return { ok: false, reason: 'MISSING_TOKEN', signatureVerified: false, provider: 'unsigned' };
    const parts = token.split('.');
    if (parts.length !== 3)
      return { ok: false, reason: 'MALFORMED', signatureVerified: false };

    let payload: Record<string, unknown>;
    try {
      payload = b64urlJson(parts[1]) as Record<string, unknown>;
    } catch {
      return { ok: false, reason: 'MALFORMED', signatureVerified: false };
    }
    if (!payload || typeof payload !== 'object')
      return { ok: false, reason: 'MALFORMED', signatureVerified: false };

    const fail = (
      reason: IntegrityVerdict['reason'],
      provider?: IntegrityVerdict['provider'],
    ): IntegrityVerdict => {
      const v: IntegrityVerdict = { ok: false, reason, signatureVerified };
      if (provider) v.provider = provider;
      return v;
    };

    let signatureVerified = false;
    let provider: IntegrityVerdict['provider'] = 'unsigned';
    if (this.verifySecret) {
      const expectedSig = createHmac('sha256', this.verifySecret)
        .update(`${parts[0]}.${parts[1]}`)
        .digest();
      let provided: Buffer;
      try {
        provided = Buffer.from(parts[2], 'base64url');
      } catch {
        return { ok: false, reason: 'UNVERIFIED_SIGNATURE', signatureVerified: false, provider: 'hmac' };
      }
      if (
        provided.length !== expectedSig.length ||
        !timingSafeEqual(provided, expectedSig)
      ) {
        return { ok: false, reason: 'UNVERIFIED_SIGNATURE', signatureVerified: false, provider: 'hmac' };
      }
      signatureVerified = true;
      provider = 'hmac';
    } else if (this.strict || !this.allowUnverifiedClaims) {
      return { ok: false, reason: 'UNVERIFIED_SIGNATURE', signatureVerified: false, provider: 'unsigned' };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const exp = Number(payload.exp);
    if (!Number.isFinite(exp) || exp < nowSec) {
      const v: IntegrityVerdict = { ok: false, reason: 'EXPIRED', signatureVerified };
      if (provider === 'hmac' || signatureVerified) v.provider = provider;
      return v;
    }

    const rawPkg =
      payload.packageName ?? payload.bundleId ?? payload.appId ?? '';
    const pkg = typeof rawPkg === 'string' ? rawPkg : '';
    const expected = platform === 'IOS' ? this.iosBundle : this.androidPackage;
    if (!expected) {
      if (this.strict) return fail('WRONG_PACKAGE', provider);
    } else if (pkg !== expected) {
      return fail('WRONG_PACKAGE', provider);
    }

    const deviceVerdicts = readStrings(payload.deviceIntegrity);
    if (deviceVerdicts.length === 0) return fail('DEVICE_NOT_TRUSTED', provider);
    if (!deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY')) {
      return fail('DEVICE_NOT_TRUSTED', provider);
    }
    if (!appRecognized(payload.appIntegrity)) {
      return fail('APP_NOT_RECOGNIZED', provider);
    }

    const ok: IntegrityVerdict = { ok: true, signatureVerified };
    if (provider === 'hmac') ok.provider = 'hmac';
    return ok;
  }

  /**
   * Full provider verification (async). Tries provider-specific verification
   * (Google Play Integrity decode API for Android, Apple JWS for iOS) when
   * configured/applicable, then falls back to HMAC/custom-claim verification.
   */
  async verifyAsync(
    token: string,
    platform: string,
    ctx?: { nonce?: string },
  ): Promise<ProviderResult> {
    if (!token) {
      return {
        verdict: { ok: false, reason: 'MISSING_TOKEN', signatureVerified: false, provider: 'unsigned' },
      };
    }

    if (platform === 'ANDROID' && this.playEnabled) {
      const play = await this.verifyPlayIntegrity(token, ctx?.nonce);
      if (play) return play;
    }

    if (platform === 'IOS') {
      const apple = await this.verifyAppleJws(token, ctx?.nonce);
      if (apple) return apple;
    }

    // Fallback: HMAC-signed or pilot-unsigned custom claim token (sync path).
    const verdict = this.verify(token, platform);
    return { verdict };
  }

  private async verifyPlayIntegrity(
    token: string,
    nonce?: string,
  ): Promise<ProviderResult | null> {
    // Play Integrity verdict tokens from the client are opaque (returned by
    // IntegrityManager). Our custom HMAC tokens are 3-part JWTs; let those pass
    // through to the fallback verifier.
    const parts = token.split('.');
    if (parts.length === 3) {
      return null;
    }

    if (!this.playEnabled) return null;
    try {
      const accessToken = await this.getGoogleAccessToken();
      const url = `https://playintegrity.googleapis.com/v1/${encodeURIComponent(
        this.androidPackage,
      )}:decodeIntegrityToken`;
      const res = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ integrityToken: token }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(
          `Play Integrity decode failed (${res.status}): ${text.slice(0, 200)}`,
        );
        return {
          verdict: {
            ok: false,
            reason: this.strict ? 'PROVIDER_UNAVAILABLE' : 'PROVIDER_REJECTED',
            signatureVerified: false,
            provider: 'play_integrity',
          },
        };
      }
      const body = (await res.json()) as { tokenPayloadExternal?: Record<string, unknown> };
      const payload = body.tokenPayloadExternal ?? {};
      return this.evaluatePlayVerdict(payload, nonce);
    } catch (err) {
      this.logger.warn(
        `Play Integrity verify error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        verdict: {
          ok: false,
          reason: 'PROVIDER_UNAVAILABLE',
          signatureVerified: false,
          provider: 'play_integrity',
        },
      };
    }
  }

  private evaluatePlayVerdict(
    payload: Record<string, unknown>,
    nonce?: string,
  ): ProviderResult {
    const fail = (reason: IntegrityVerdict['reason']): ProviderResult => ({
      verdict: { ok: false, reason, signatureVerified: true, provider: 'play_integrity' },
      payload,
    });

    const requestDetails = (payload.requestDetails ?? {}) as Record<string, unknown>;
    const reqPkg = requestDetails.requestPackageName;
    if (typeof reqPkg === 'string' && reqPkg !== this.androidPackage) {
      return fail('WRONG_PACKAGE');
    }
    if (nonce && typeof requestDetails.nonce === 'string') {
      if (requestDetails.nonce !== nonce) {
        return fail('NONCE_MISMATCH');
      }
    }

    const appIntegrity = (payload.appIntegrity ?? {}) as Record<string, unknown>;
    const appVerdict = String(appIntegrity.appRecognitionVerdict ?? '');
    if (appVerdict && appVerdict !== 'PLAY_RECOGNIZED') {
      return fail('APP_NOT_RECOGNIZED');
    }

    const deviceIntegrity = (payload.deviceIntegrity ?? {}) as Record<string, unknown>;
    const deviceVerdicts = readStrings(deviceIntegrity.deviceRecognitionVerdict);
    if (deviceVerdicts.length === 0 || !deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY')) {
      const anyIntegrity = deviceVerdicts.some((v) => v.includes('INTEGRITY'));
      if (!anyIntegrity) return fail('DEVICE_NOT_TRUSTED');
    }

    return {
      verdict: { ok: true, signatureVerified: true, provider: 'play_integrity' },
      payload,
    };
  }

  private async getGoogleAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.playAccessToken && this.playAccessToken.expiresAt > now + 60_000) {
      return this.playAccessToken.value;
    }
    const issuedAt = Math.floor(now / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
    ).toString('base64url');
    const claims = Buffer.from(
      JSON.stringify({
        iss: this.playClientEmail,
        scope: PLAY_INTEGRITY_SCOPE,
        aud: GOOGLE_TOKEN_URL,
        iat: issuedAt,
        exp: issuedAt + 3600,
      }),
    ).toString('base64url');
    const unsigned = `${header}.${claims}`;
    const assertion = `${unsigned}.${sign(
      'sha256',
      Buffer.from(unsigned),
      this.playPrivateKey,
    ).toString('base64url')}`;

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Google OAuth ${res.status}: ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error('No access_token');
    const ttl = Number(body.expires_in ?? 3600);
    this.playAccessToken = {
      value: body.access_token,
      expiresAt: now + (Number.isFinite(ttl) && ttl > 0 ? ttl : 3600) * 1000,
    };
    return body.access_token;
  }

  /**
   * Verify Apple provider-issued JWS (e.g. DeviceCheck/App Attest artifacts
   * delivered as JWT signed by Apple keys). Full App Attest attestation (CBOR)
   * requires specialized parsing; JWS-form tokens are verified against Apple JWKS
   * when present. Returns null to fall back to HMAC/custom claims.
   */
  private async verifyAppleJws(
    token: string,
    _nonce?: string,
  ): Promise<ProviderResult | null> {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let header: { alg?: string; kid?: string; typ?: string; x5c?: string[] };
    let payload: Record<string, unknown>;
    try {
      header = b64urlJson(parts[0]) as typeof header;
      payload = b64urlJson(parts[1]) as Record<string, unknown>;
    } catch {
      return null;
    }

    // If it has our expected custom-claim shape and HMAC is configured, let the
    // fallback HMAC verifier handle it (avoids misclassifying custom tokens).
    if (this.verifySecret && header.alg === 'HS256') {
      return null;
    }

    // Only attempt Apple JWS verification for asymmetric algs with kid/x5c.
    const alg = String(header.alg || '');
    if (!alg || alg === 'HS256' || alg === 'none') return null;
    if (!header.kid && !Array.isArray(header.x5c)) return null;

    try {
      const verified = await this.verifyJwsSignature(parts, header, alg);
      if (!verified) {
        return {
          verdict: { ok: false, reason: 'UNVERIFIED_SIGNATURE', signatureVerified: false, provider: 'apple_app_attest' },
        };
      }
      const exp = payload.exp;
      if (typeof exp === 'number' && exp <= Math.floor(Date.now() / 1000)) {
        return { verdict: { ok: false, reason: 'EXPIRED', signatureVerified: true, provider: 'apple_app_attest' } };
      }
      const bundle = payload.bundleId ?? payload.bundle_id ?? payload.app_id;
      if (typeof bundle === 'string' && bundle !== this.iosBundle) {
        return { verdict: { ok: false, reason: 'WRONG_PACKAGE', signatureVerified: true, provider: 'apple_app_attest' }, payload };
      }
      return { verdict: { ok: true, signatureVerified: true, provider: 'apple_app_attest' }, payload };
    } catch (err) {
      this.logger.warn(
        `Apple JWS verify error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        verdict: { ok: false, reason: 'PROVIDER_UNAVAILABLE', signatureVerified: false, provider: 'apple_app_attest' },
      };
    }
  }

  private async verifyJwsSignature(
    parts: string[],
    header: { kid?: string; x5c?: string[] },
    alg: string,
  ): Promise<boolean> {
    const data = Buffer.from(`${parts[0]}.${parts[1]}`);
    const sig = Buffer.from(parts[2], 'base64url');

    // Prefer x5c leaf cert if present (e.g. App Attest receipts).
    if (Array.isArray(header.x5c) && header.x5c.length > 0) {
      try {
        const pem = `-----BEGIN CERTIFICATE-----\n${header.x5c[0]}\n-----END CERTIFICATE-----`;
        const key = createPublicKey(pem);
        return this.verifyWithKey(key, alg, data, sig);
      } catch {
        // fall through to JWKS
      }
    }

    const jwks = await this.getAppleJwks();
    const jwk = jwks.keys.find((k) => k.kid === header.kid) ?? jwks.keys[0];
    if (!jwk) return false;
    const key = createPublicKey({ key: jwk, format: 'jwk' });
    return this.verifyWithKey(key, alg, data, sig);
  }

  private verifyWithKey(
    key: ReturnType<typeof createPublicKey>,
    alg: string,
    data: Buffer,
    sig: Buffer,
  ): boolean {
    // JWS ES* signatures are IEEE P1363 (r||s); RSA uses PKCS#1 v1.5.
    if (alg.startsWith('ES')) {
      const hash = alg === 'ES384' ? 'sha384' : alg === 'ES512' ? 'sha512' : 'sha256';
      return verify(hash, data, { key, dsaEncoding: 'ieee-p1363' }, sig);
    }
    const hash =
      alg === 'RS384' ? 'RSA-SHA384' : alg === 'RS512' ? 'RSA-SHA512' : 'RSA-SHA256';
    const verifier = createVerify(hash);
    verifier.update(data);
    verifier.end();
    return verifier.verify(key, sig);
  }

  private async getAppleJwks(): Promise<{ keys: JsonWebKey[] }> {
    const now = Date.now();
    if (this.appleJwks && this.appleJwks.expiresAt > now) {
      return { keys: this.appleJwks.keys };
    }
    const res = await fetch(this.appleJwksUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Apple JWKS ${res.status}`);
    const body = (await res.json()) as { keys?: JsonWebKey[] };
    const keys = Array.isArray(body.keys) ? body.keys : [];
    this.appleJwks = { keys, expiresAt: now + 10 * 60_000 };
    return { keys };
  }

  resolveSignal(opts: {
    integrityToken?: string;
    deviceCompromised: boolean;
    platform?: string;
  }): { ok: boolean; verdict: IntegrityVerdict | null } {
    if (opts.integrityToken) {
      const verdict = this.verify(
        opts.integrityToken,
        opts.platform ?? 'ANDROID',
      );
      return { ok: verdict.ok, verdict };
    }
    if (this.strict) {
      return {
        ok: false,
        verdict: {
          ok: false,
          reason: 'MISSING_TOKEN',
          signatureVerified: false,
        },
      };
    }
    return { ok: false, verdict: null };
  }

  async resolveSignalAsync(opts: {
    integrityToken?: string;
    deviceCompromised: boolean;
    platform?: string;
    nonce?: string;
  }): Promise<{ ok: boolean; verdict: IntegrityVerdict | null }> {
    if (opts.integrityToken) {
      const res = await this.verifyAsync(
        opts.integrityToken,
        opts.platform ?? 'ANDROID',
        { nonce: opts.nonce },
      );
      return { ok: res.verdict.ok, verdict: res.verdict };
    }
    return this.resolveSignal(opts);
  }
}
