import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface IntegrityVerdict {
  ok: boolean;
  reason?:
    | 'MISSING_TOKEN'
    | 'MALFORMED'
    | 'EXPIRED'
    | 'WRONG_PACKAGE'
    | 'DEVICE_NOT_TRUSTED'
    | 'APP_NOT_RECOGNIZED'
    | 'UNVERIFIED_SIGNATURE';
  signatureVerified: boolean;
}

@Injectable()
export class IntegrityService {
  private readonly logger = new Logger(IntegrityService.name);
  private readonly strict: boolean;
  private readonly androidPackage: string;
  private readonly iosBundle: string;
  private readonly verifySecret: string;
  private readonly allowUnverifiedClaims: boolean;

  constructor(config: ConfigService) {
    const isProduction =
      String(config.get('NODE_ENV', '')).toLowerCase() === 'production';
    const configured = config.get<string>('INTEGRITY_STRICT');
    if (configured === undefined) {
      // Secure by default: production rejects missing/invalid tokens unless
      // the pilot explicitly opts out while the client cannot send them yet.
      this.strict = isProduction;
    } else {
      this.strict = String(configured).toLowerCase() === 'true';
      if (isProduction && !this.strict) {
        this.logger.warn(
          'INTEGRITY_STRICT=false in production: attendance accepts missing integrity tokens (pilot mode)',
        );
      }
    }

    this.androidPackage = String(config.get('ANDROID_PACKAGE_NAME', ''));
    this.iosBundle = String(config.get('IOS_BUNDLE_ID', ''));
    this.verifySecret = String(config.get('INTEGRITY_TOKEN_SECRET', ''));

    const allowUnsigned = String(
      config.get('INTEGRITY_ALLOW_UNVERIFIED_CLAIMS', ''),
    )
      .trim()
      .toLowerCase();
    this.allowUnverifiedClaims =
      !isProduction && ['1', 'true', 'yes'].includes(allowUnsigned);
    if (isProduction && allowUnsigned) {
      this.logger.warn(
        'INTEGRITY_ALLOW_UNVERIFIED_CLAIMS is ignored in production',
      );
    }
  }

  get strictMode(): boolean {
    return this.strict;
  }

  verify(token: string | undefined, platform: string): IntegrityVerdict {
    if (!token)
      return { ok: false, reason: 'MISSING_TOKEN', signatureVerified: false };
    let payload: Record<string, unknown>;
    let signatureVerified = false;
    try {
      const parts = token.split('.');
      if (parts.length !== 3)
        return { ok: false, reason: 'MALFORMED', signatureVerified: false };

      if (this.verifySecret) {
        const expected = createHmac('sha256', this.verifySecret)
          .update(`${parts[0]}.${parts[1]}`)
          .digest('base64url');
        const sig = parts[2] ?? '';
        const a = Buffer.from(expected);
        const b = Buffer.from(sig);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return {
            ok: false,
            reason: 'UNVERIFIED_SIGNATURE',
            signatureVerified: false,
          };
        }
        signatureVerified = true;
      } else if (!this.allowUnverifiedClaims) {
        // Fail-closed: never trust decoded claims without cryptographic
        // verification (prevents forged integrity tokens).
        return {
          ok: false,
          reason: 'UNVERIFIED_SIGNATURE',
          signatureVerified: false,
        };
      }

      payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as Record<string, unknown>;
    } catch {
      return { ok: false, reason: 'MALFORMED', signatureVerified: false };
    }
    const fail = (
      reason: NonNullable<IntegrityVerdict['reason']>,
    ): IntegrityVerdict => ({
      ok: false,
      reason,
      signatureVerified,
    });
    const nowSec = Math.floor(Date.now() / 1000);

    const exp = Number((payload as { exp?: unknown }).exp);
    if (!Number.isFinite(exp) || exp < nowSec) return fail('EXPIRED');

    const rawPkg =
      (payload as { packageName?: unknown }).packageName ??
      (payload as { bundleId?: unknown }).bundleId ??
      (payload as { appId?: unknown }).appId ??
      '';
    const pkg = typeof rawPkg === 'string' ? rawPkg : '';
    const expected = platform === 'IOS' ? this.iosBundle : this.androidPackage;
    if (!expected) {
      if (this.strict) return fail('WRONG_PACKAGE');
    } else if (pkg !== expected) {
      return fail('WRONG_PACKAGE');
    }

    if (platform !== 'IOS') {
      const deviceVerdicts = readStrings(
        (payload as { deviceIntegrity?: unknown }).deviceIntegrity,
      );
      if (deviceVerdicts.length === 0)
        return fail('DEVICE_NOT_TRUSTED');
      if (!deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY')) {
        return fail('DEVICE_NOT_TRUSTED');
      }
      if (
        !appRecognized((payload as { appIntegrity?: unknown }).appIntegrity)
      ) {
        return fail('APP_NOT_RECOGNIZED');
      }
    } else {
      const deviceVerdicts = readStrings(
        (payload as { deviceIntegrity?: unknown }).deviceIntegrity,
      );
      if (deviceVerdicts.length === 0)
        return fail('DEVICE_NOT_TRUSTED');
      if (!deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY')) {
        return fail('DEVICE_NOT_TRUSTED');
      }
      const appVerdicts = readStrings(
        (payload as { appIntegrity?: unknown }).appIntegrity,
      );
      if (appVerdicts.length === 0 || !appVerdicts.includes('PLAY_RECOGNIZED')) {
        return fail('APP_NOT_RECOGNIZED');
      }
    }
    return { ok: true, signatureVerified };
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
}

function readStrings(v: unknown): string[] {
  if (Array.isArray(v))
    return v.filter((x): x is string => typeof x === 'string');
  if (
    v &&
    typeof v === 'object' &&
    Array.isArray((v as { deviceVerdict?: unknown }).deviceVerdict)
  ) {
    return (
      (v as { deviceVerdict?: unknown }).deviceVerdict as unknown[]
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
