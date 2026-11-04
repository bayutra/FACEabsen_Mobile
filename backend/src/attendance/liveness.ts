import type { LivenessAttestation } from '../common/crypto.js';

export type LivenessReject =
  | 'LIVENESS_FAILED'
  | 'LIVENESS_STALE'
  | 'LIVENESS_EMPTY'
  | 'LIVENESS_MODE_UNSUPPORTED';

const SUPPORTED_MODES = new Set(['active', 'passive']);

export function validateLiveness(
  att: LivenessAttestation,
  now: Date,
  maxAgeMin: number,
): { ok: true } | { ok: false; reason: LivenessReject } {
  if (!att.passed) {
    return { ok: false, reason: 'LIVENESS_FAILED' };
  }
  const mode = att.mode ?? 'active';
  if (!SUPPORTED_MODES.has(mode)) {
    return { ok: false, reason: 'LIVENESS_MODE_UNSUPPORTED' };
  }
  if (mode === 'passive') {
    const pad = typeof att.padScore === 'number' ? att.padScore : 0;
    if (!(pad > 0)) {
      return { ok: false, reason: 'LIVENESS_EMPTY' };
    }
  } else if (!Array.isArray(att.challenges) || att.challenges.length === 0) {
    return { ok: false, reason: 'LIVENESS_EMPTY' };
  }
  const at = new Date(att.completedAt);
  if (
    Number.isNaN(at.getTime()) ||
    Math.abs(now.getTime() - at.getTime()) > maxAgeMin * 60_000
  ) {
    return { ok: false, reason: 'LIVENESS_STALE' };
  }
  return { ok: true };
}
