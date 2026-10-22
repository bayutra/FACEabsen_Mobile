import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  totp,
  verifyTotp,
} from './totp.js';

const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'));
const RFC_VECTORS: Array<[number, string]> = [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
];

describe('totp RFC 6238 Appendix B (SHA-1, 6-digit truncation)', () => {
  it.each(RFC_VECTORS)('T=%i -> %s', (tSeconds, expected) => {
    expect(totp(RFC_SECRET, tSeconds * 1000)).toBe(expected);
  });

  it('hotp counter 0..4 matches the RFC 4226 Appendix D sequence tail', () => {
    const secret = Buffer.from('12345678901234567890', 'ascii');

    expect([0, 1, 2, 3, 4].map((c) => hotp(secret, c))).toEqual([
      '755224',
      '287082',
      '359152',
      '969429',
      '338314',
    ]);
  });
});

describe('verifyTotp window', () => {
  const atMs = 1_728_000_000_000;

  it('accepts current, previous, and next step (±1)', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, totp(secret, atMs), atMs)).toBe(true);
    expect(verifyTotp(secret, totp(secret, atMs - 30_000), atMs)).toBe(true);
    expect(verifyTotp(secret, totp(secret, atMs + 30_000), atMs)).toBe(true);
  });

  it('rejects codes two steps away', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, totp(secret, atMs - 60_000), atMs)).toBe(false);
    expect(verifyTotp(secret, totp(secret, atMs + 60_000), atMs)).toBe(false);
  });

  it('rejects wrong codes, short/long input, and non-numeric input', () => {
    const secret = generateTotpSecret();
    const current = totp(secret, atMs);
    const wrong = current === '000000' ? '000001' : '000000';
    expect(verifyTotp(secret, wrong, atMs)).toBe(false);
    expect(verifyTotp(secret, current.slice(0, 5), atMs)).toBe(false);
    expect(verifyTotp(secret, `${current}7`, atMs)).toBe(false);
    expect(verifyTotp(secret, 'abcdef', atMs)).toBe(false);
    expect(verifyTotp(secret, '', atMs)).toBe(false);
  });

  it('returns false (never throws) for a corrupt stored secret', () => {
    expect(verifyTotp('!!!not-base32!!!', '123456')).toBe(false);
  });
});

describe('base32', () => {
  it('round-trips 20 random bytes without padding', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
  });

  it('decodes case-insensitively and tolerates padding', () => {
    const upper = base32Encode(Buffer.from('hello world'));
    const lower = upper.toLowerCase();
    expect(base32Decode(lower)).toEqual(Buffer.from('hello world'));
    expect(base32Decode(`${upper}====`)).toEqual(Buffer.from('hello world'));
  });

  it('rejects invalid characters and bad lengths', () => {
    for (const bad of ['ABC$EFGH', 'hello!', '12345679', 'mzxw6===!']) {
      expect(() => base32Decode(bad)).toThrow();
    }
    expect(() => base32Decode('A')).toThrow();
    expect(() => base32Decode('')).toThrow();
  });
});
