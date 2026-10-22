import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IntegrityVerdict {
  ok: boolean;
  reason?:
    | 'MISSING_TOKEN'
    | 'MALFORMED'
    | 'EXPIRED'
    | 'WRONG_PACKAGE'
    | 'DEVICE_NOT_TRUSTED'
    | 'APP_NOT_RECOGNIZED';

  signatureVerified: false;
}

@Injectable()
export class IntegrityService {
  private readonly strict: boolean;
  private readonly androidPackage: string;
  private readonly iosBundle: string;

  constructor(config: ConfigService) {
    this.strict =
      String(config.get('INTEGRITY_STRICT', 'false')).toLowerCase() !== 'false'
        ? String(config.get('INTEGRITY_STRICT', 'false')).toLowerCase() ===
          'true'
        : false;

    this.androidPackage = String(config.get('ANDROID_PACKAGE_NAME', ''));
    this.iosBundle = String(config.get('IOS_BUNDLE_ID', ''));
  }

  get strictMode(): boolean {
    return this.strict;
  }

  verify(token: string | undefined, platform: string): IntegrityVerdict {
    if (!token)
      return { ok: false, reason: 'MISSING_TOKEN', signatureVerified: false };
    let payload: Record<string, unknown>;
    try {
      const parts = token.split('.');
      if (parts.length !== 3)
        return { ok: false, reason: 'MALFORMED', signatureVerified: false };
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
      signatureVerified: false,
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
      if (
        deviceVerdicts.length > 0 &&
        !deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY')
      ) {
        return fail('DEVICE_NOT_TRUSTED');
      }
      const appVerdicts = readStrings(
        (payload as { appIntegrity?: unknown }).appIntegrity,
      );
      if (appVerdicts.length > 0 && !appVerdicts.includes('PLAY_RECOGNIZED')) {
        return fail('APP_NOT_RECOGNIZED');
      }
    }
    return { ok: true, signatureVerified: false };
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
    return { ok: !opts.deviceCompromised, verdict: null };
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
