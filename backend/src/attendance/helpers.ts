import { createHash, createPublicKey, verify } from 'node:crypto';
import { workDateKeyIn } from '../shifts/shift-time.js';

const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export interface LivenessAttestation {
  passed: boolean;
  mode?: 'active' | 'passive';
  completedAt: string;
  score: number;
  padScore?: number;
  challenges?: string[];
}

export interface SignPayloadV1 {
  action: 'check-in' | 'check-out';
  deviceId: string;
  requestId: string;
  captureAt: string;
  queuedAt?: string;
  nonce: string;
  faceEmbedding: number[];
  liveness: LivenessAttestation;
}

export function buildSignMessage(
  requestId: string,
  requestTimestamp: string,
): string {
  return `${requestId}.${requestTimestamp}`;
}

export function canonicalEmbedding(values: number[]): string {
  return values.map((v) => v.toFixed(6)).join(',');
}

export function canonicalLiveness(att: LivenessAttestation): string {
  const mode = att.mode ?? 'active';
  const score = typeof att.score === 'number' ? att.score : 0;
  const pad = typeof att.padScore === 'number' ? att.padScore : 0;
  return [
    `mode:${mode}`,
    `passed:${att.passed ? 1 : 0}`,
    `completedAt:${att.completedAt}`,
    `score:${score.toFixed(6)}`,
    `padScore:${pad.toFixed(6)}`,
    `challenges:${(att.challenges ?? []).join(',')}`,
  ].join('|');
}

export function buildSignMessageV1(payload: SignPayloadV1): string {
  const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
  return [
    'v1',
    payload.action,
    payload.deviceId,
    payload.requestId,
    payload.captureAt,
    payload.queuedAt ?? '',
    payload.nonce,
    sha(canonicalEmbedding(payload.faceEmbedding)),
    sha(canonicalLiveness(payload.liveness)),
  ].join('|');
}

export function verifyDeviceSignature(
  devicePublicKeyB64: string,
  message: string,
  signatureB64: string,
): boolean {
  try {
    const raw = Buffer.from(devicePublicKeyB64, 'base64');
    if (raw.length !== 32) return false;
    const key = createPublicKey({
      key: Buffer.concat([SPKI_PREFIX, raw]),
      format: 'der',
      type: 'spki',
    });
    return verify(
      null,
      Buffer.from(message, 'utf8'),
      key,
      Buffer.from(signatureB64, 'base64'),
    );
  } catch {
    return false;
  }
}

export function cosineSimilarity(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
): number {
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

export interface LivenessAttestation {
  passed: boolean;
  challenges?: string[];
  completedAt: string;
  score?: number;

  mode?: string;

  padScore?: number;
}

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

export function utcWorkDate(now = new Date()): { date: Date; key: string } {
  const key = now.toISOString().slice(0, 10);
  return { date: new Date(`${key}T00:00:00.000Z`), key };
}

export function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  } catch {
    throw new Error(`Invalid HOSPITAL_TZ: ${timeZone}`);
  }
}

export function hospitalWorkDate(
  now = new Date(),
  timeZone = 'Asia/Jakarta',
): { date: Date; key: string } {
  const key = workDateKeyIn(now, timeZone);
  return { date: new Date(`${key}T00:00:00.000Z`), key };
}

export type PunchTimeReject = 'LIVENESS_STALE' | 'CAPTURE_IN_FUTURE' | 'QUEUED_TIME_INVALID';

export function validatePunchTime(input: {
  captureAt: string;
  queuedAt?: string;
  livenessCompletedAt: string;
  now: Date;
  maxOnlineAgeMin: number;
  maxOfflineAgeHours: number;
}): { ok: true; offline: boolean } | { ok: false; reason: PunchTimeReject } {
  const capture = new Date(input.captureAt);
  const completed = new Date(input.livenessCompletedAt);
  if (Number.isNaN(capture.getTime()) || Number.isNaN(completed.getTime())) {
    return { ok: false, reason: 'LIVENESS_STALE' };
  }
  if (capture.getTime() - input.now.getTime() > 2 * 60_000) {
    return { ok: false, reason: 'CAPTURE_IN_FUTURE' };
  }
  const offline = Boolean(input.queuedAt);
  let queued: Date | undefined;
  if (input.queuedAt) {
    queued = new Date(input.queuedAt);
    if (Number.isNaN(queued.getTime())) {
      return { ok: false, reason: 'QUEUED_TIME_INVALID' };
    }
    if (queued.getTime() < capture.getTime() || queued.getTime() > input.now.getTime()) {
      return { ok: false, reason: 'QUEUED_TIME_INVALID' };
    }
  }
  const maxAgeMs = offline
    ? input.maxOfflineAgeHours * 3600_000
    : input.maxOnlineAgeMin * 60_000;
  if (input.now.getTime() - capture.getTime() > maxAgeMs) {
    return { ok: false, reason: 'LIVENESS_STALE' };
  }
  if (offline && Math.abs(completed.getTime() - capture.getTime()) > 2 * 60_000) {
    return { ok: false, reason: 'LIVENESS_STALE' };
  }
  return { ok: true, offline };
}
