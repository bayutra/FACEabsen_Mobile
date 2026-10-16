import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IntegrityVerdict {
  ok: boolean;
  reason?: 'MISSING_TOKEN' | 'MALFORMED' | 'EXPIRED' | 'WRONG_PACKAGE' | 'DEVICE_NOT_TRUSTED' | 'APP_NOT_RECOGNIZED';
  /**
   * Structural validation only. The token signature is NEVER verified here —
   * that requires Google/Apple server-to-server calls (fase-2 hook below).
   * A structurally-valid token proves format, not authenticity.
   */
  signatureVerified: false;
}

/**
 * Play Integrity (Android) + App Attest (iOS) structural verifier.
 * Offline check: JWT shape, REQUIRED expiry, package/bundle, REQUIRED
 * device+app verdicts (Android). Anything missing or mismatched fails closed.
 * Online check (Google/Apple server-to-server) is the fase-2 hardening hook:
 * pass the token to Play Integrity Decrypt+Verify API before trusting
 * high-risk actions.
 *
 * Security posture: because the signature is unverified, a structurally-valid
 * verdict is a weak signal. Strict mode therefore only fails *absent* tokens
 * loudly; present-but-unverifiable tokens still resolve per the rules below.
 * Do NOT enable INTEGRITY_STRICT in production until the mobile app actually
 * sends tokens — with the current client every punch would brick.
 */
@Injectable()
export class IntegrityService {
  private readonly strict: boolean;
  private readonly androidPackage: string;
  private readonly iosBundle: string;

  constructor(config: ConfigService) {
    this.strict = String(config.get('INTEGRITY_STRICT', 'false')).toLowerCase() !== 'false'
      ? String(config.get('INTEGRITY_STRICT', 'false')).toLowerCase() === 'true'
      : false;
    // Default false (dev-friendly); .env.production.example keeps false
    // until mobile sends tokens AND signatures verify server-to-server.
    this.androidPackage = String(config.get('ANDROID_PACKAGE_NAME', ''));
    this.iosBundle = String(config.get('IOS_BUNDLE_ID', ''));
  }

  get strictMode(): boolean {
    return this.strict;
  }

  verify(token: string | undefined, platform: string): IntegrityVerdict {
    if (!token) return { ok: false, reason: 'MISSING_TOKEN', signatureVerified: false };
    let payload: Record<string, unknown>;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return { ok: false, reason: 'MALFORMED', signatureVerified: false };
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
    } catch {
      return { ok: false, reason: 'MALFORMED', signatureVerified: false };
    }
    const fail = (reason: NonNullable<IntegrityVerdict['reason']>): IntegrityVerdict => ({
      ok: false,
      reason,
      signatureVerified: false,
    });
    const nowSec = Math.floor(Date.now() / 1000);
    // Expiry is REQUIRED: a token without exp never expires, so its absence
    // is treated as expired rather than skipped.
    const exp = Number((payload as { exp?: unknown }).exp);
    if (!Number.isFinite(exp) || exp < nowSec) return fail('EXPIRED');

    const rawPkg = (payload as { packageName?: unknown }).packageName
      ?? (payload as { bundleId?: unknown }).bundleId
      ?? (payload as { appId?: unknown }).appId
      ?? '';
    const pkg = typeof rawPkg === 'string' ? rawPkg : '';
    const expected = platform === 'IOS' ? this.iosBundle : this.androidPackage;
    if (!expected) {
      // No expected package configured: in strict mode this misconfiguration
      // must not silently pass every token.
      if (this.strict) return fail('WRONG_PACKAGE');
    } else if (pkg !== expected) {
      return fail('WRONG_PACKAGE');
    }

    // Verdict arrays are REQUIRED on Android: omitting deviceIntegrity
    // entirely used to pass. iOS App Attest payloads carry different claims,
    // so the requirement only applies to the Play Integrity shape.
    // Note the genuine Play shapes: deviceIntegrity.deviceVerdict is an
    // ARRAY, appIntegrity.appRecognitionVerdict is a STRING.
    if (platform !== 'IOS') {
      const deviceVerdicts = readStrings((payload as { deviceIntegrity?: unknown }).deviceIntegrity);
      if (!deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY')) {
        return fail('DEVICE_NOT_TRUSTED');
      }
      if (!appRecognized((payload as { appIntegrity?: unknown }).appIntegrity)) {
        return fail('APP_NOT_RECOGNIZED');
      }
    } else {
      const deviceVerdicts = readStrings((payload as { deviceIntegrity?: unknown }).deviceIntegrity);
      if (deviceVerdicts.length > 0 && !deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY')) {
        return fail('DEVICE_NOT_TRUSTED');
      }
      const appVerdicts = readStrings((payload as { appIntegrity?: unknown }).appIntegrity);
      if (appVerdicts.length > 0 && !appVerdicts.includes('PLAY_RECOGNIZED')) {
        return fail('APP_NOT_RECOGNIZED');
      }
    }
    return { ok: true, signatureVerified: false };
  }

  /**
   * Resolve the integrityOk risk signal.
   * - Token valid → true (stronger than client jailbreak claim).
   * - No token + non-strict → fallback to !deviceCompromised (legacy clients).
   * - No token + strict → false (caller must reject INTEGRITY_FAILED).
   */
  resolveSignal(opts: { integrityToken?: string; deviceCompromised: boolean; platform?: string }): { ok: boolean; verdict: IntegrityVerdict | null } {
    if (opts.integrityToken) {
      const verdict = this.verify(opts.integrityToken, opts.platform ?? 'ANDROID');
      return { ok: verdict.ok, verdict };
    }
    if (this.strict) {
      return { ok: false, verdict: { ok: false, reason: 'MISSING_TOKEN', signatureVerified: false } };
    }
    return { ok: !opts.deviceCompromised, verdict: null };
  }
}

function readStrings(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (v && typeof v === 'object' && Array.isArray((v as { deviceVerdict?: unknown }).deviceVerdict)) {
    return ((v as { deviceVerdict?: unknown }).deviceVerdict as unknown[]).filter((x): x is string => typeof x === 'string');
  }
  return [];
}

/** Genuine Play shape carries the app verdict as a plain string. */
function appRecognized(v: unknown): boolean {
  if (v === 'PLAY_RECOGNIZED') return true;
  if (Array.isArray(v)) return v.includes('PLAY_RECOGNIZED');
  if (v && typeof v === 'object') {
    const r = (v as { appRecognitionVerdict?: unknown }).appRecognitionVerdict;
    return r === 'PLAY_RECOGNIZED' || (Array.isArray(r) && r.includes('PLAY_RECOGNIZED'));
  }
  return false;
}
