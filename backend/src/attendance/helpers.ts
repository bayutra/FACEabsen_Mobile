import { createPublicKey, verify } from 'node:crypto';
import { workDateKeyIn } from '../shifts/shift-time.js';

// SPKI DER prefix for Ed25519 (RFC 8410) + 32-byte raw key.
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function buildSignMessage(requestId: string, requestTimestamp: string): string {
  return `${requestId}.${requestTimestamp}`;
}

/** Verifies device Ed25519 signature (base64) over the sign message. */
export function verifyDeviceSignature(
  devicePublicKeyB64: string,
  message: string,
  signatureB64: string,
): boolean {
  try {
    const raw = Buffer.from(devicePublicKeyB64, 'base64');
    if (raw.length !== 32) return false;
    const key = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: 'der', type: 'spki' });
    return verify(null, Buffer.from(message, 'utf8'), key, Buffer.from(signatureB64, 'base64'));
  } catch {
    return false;
  }
}

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length || a.length === 0) return -1;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return -1;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export type LivenessReject =
  | 'LIVENESS_FAILED'
  | 'LIVENESS_STALE'
  | 'LIVENESS_EMPTY'
  | 'LIVENESS_MODE_UNSUPPORTED';

/** Attestation shapes the client may send (PRD §14, passive PAD rollout). */
export interface LivenessAttestation {
  passed: boolean;
  challenges?: string[];
  completedAt: string;
  score?: number;
  /** `active` = blink/head-turn challenges, `passive` = Face-ID-style. */
  mode?: string;
  /** Anti-spoofing confidence reported by the on-device analyser (0..1). */
  padScore?: number;
}

const SUPPORTED_MODES = new Set(['active', 'passive']);

/**
 * Shape + freshness check for the client liveness attestation.
 *
 * NOTE on trust: this value is client-asserted, so it is NOT a security
 * boundary by itself — a modified client can post `passed: true` directly.
 * The real anchors are the face-template match, the geofence, and the device
 * integrity token. Passive mode removes the *commands* the user must perform;
 * it does not add a new server-verifiable fact.
 */
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
    // Passive attestations carry no challenge list; require the analyser to
    // report a confidence so an empty "passed" cannot be waved through.
    const pad = typeof att.padScore === 'number' ? att.padScore : 0;
    if (!(pad > 0)) {
      return { ok: false, reason: 'LIVENESS_EMPTY' };
    }
  } else if (!Array.isArray(att.challenges) || att.challenges.length === 0) {
    return { ok: false, reason: 'LIVENESS_EMPTY' };
  }
  const at = new Date(att.completedAt);
  if (Number.isNaN(at.getTime()) || Math.abs(now.getTime() - at.getTime()) > maxAgeMin * 60_000) {
    return { ok: false, reason: 'LIVENESS_STALE' };
  }
  return { ok: true };
}

/** UTC calendar day anchor (legacy default; prefer hospitalWorkDate). */
export function utcWorkDate(now = new Date()): { date: Date; key: string } {
  const key = now.toISOString().slice(0, 10);
  return { date: new Date(`${key}T00:00:00.000Z`), key };
}

/**
 * Throws when `timeZone` is not a valid IANA zone. Called at boot so a typo
 * in HOSPITAL_TZ fails fast instead of mis-scoring every punch.
 */
export function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  } catch {
    throw new Error(`Invalid HOSPITAL_TZ: ${timeZone}`);
  }
}

/**
 * Hospital-local calendar day for an instant. The stored `date` keeps the
 * UTC-midnight-of-key convention (same as schedule rows created from
 * `YYYY-MM-DD` strings), so exact-date lookups keep matching — only the
 * *key derivation* moves from UTC to the hospital zone.
 */
export function hospitalWorkDate(now = new Date(), timeZone = 'Asia/Jakarta'): { date: Date; key: string } {
  const key = workDateKeyIn(now, timeZone);
  return { date: new Date(`${key}T00:00:00.000Z`), key };
}
