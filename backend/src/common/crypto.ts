import { createHash, createPublicKey, verify } from 'node:crypto';

const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

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

export interface LivenessAttestation {
  passed: boolean;
  challenges?: string[];
  completedAt: string;
  score?: number;

  mode?: string;

  padScore?: number;
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
  const sha = (s: string) =>
    createHash('sha256').update(s, 'utf8').digest('hex');
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
