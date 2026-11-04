import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildSignMessage,
  buildSignMessageV1,
  canonicalEmbedding,
  canonicalLiveness,
  cosineSimilarity,
  verifyDeviceSignature,
} from './crypto.js';

describe('cosineSimilarity', () => {
  it('identical 1, orthogonal 0, opposite -1, empty -1', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 9);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 9);
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 9);
    expect(cosineSimilarity([], [])).toBe(-1);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(-1);
  });
});

describe('device signature (Ed25519)', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const rawB64 = publicKey
    .export({ format: 'der', type: 'spki' })
    .subarray(-32)
    .toString('base64');
  const msg = buildSignMessage('req-1', '2026-10-05T07:00:00.000Z');

  it('valid verifies; tampered/garbage rejected', () => {
    expect(msg).toBe('req-1.2026-10-05T07:00:00.000Z');
    const sig = sign(null, Buffer.from(msg, 'utf8'), privateKey).toString(
      'base64',
    );
    expect(verifyDeviceSignature(rawB64, msg, sig)).toBe(true);
    expect(verifyDeviceSignature(rawB64, msg + 'x', sig)).toBe(false);
    expect(verifyDeviceSignature(rawB64, msg, 'not-base64!!!')).toBe(false);
    expect(verifyDeviceSignature('short', msg, sig)).toBe(false);
  });
});

const liveness = {
  passed: true,
  mode: 'active' as const,
  completedAt: '2026-10-23T07:00:00.000Z',
  score: 0.987654321,
  padScore: 0.5,
  challenges: ['blink', 'turn_left'],
};

describe('signature v1', () => {
  it('memformat embedding 6 desimal', () => {
    expect(canonicalEmbedding([0.1, -0.25, 0.3333333333])).toBe(
      '0.100000,-0.250000,0.333333',
    );
  });

  it('memformat liveness deterministik', () => {
    expect(canonicalLiveness(liveness)).toBe(
      'mode:active|passed:1|completedAt:2026-10-23T07:00:00.000Z|score:0.987654|padScore:0.500000|challenges:blink,turn_left',
    );
  });

  it('membangun pesan v1 persis', () => {
    expect(
      buildSignMessageV1({
        action: 'check-in',
        deviceId: 'd1',
        requestId: '11111111-2222-3333-4444-555555555555',
        captureAt: '2026-10-23T07:00:00.000Z',
        nonce: 'nonce-abc',
        faceEmbedding: [0.1, -0.25, 0.3333333333],
        liveness,
      }),
    ).toBe(
      'v1|check-in|d1|11111111-2222-3333-4444-555555555555|2026-10-23T07:00:00.000Z||nonce-abc|666a0811ed27009b72350c48071862ff9228939118c89672bc349194caef88fb|b019db2a3f847f4fc92123aaf7f1b77be6e5dd9a1ef9f1311a02d30bd0cde14f',
    );
  });
});
