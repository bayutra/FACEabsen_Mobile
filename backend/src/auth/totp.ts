// TOTP core (RFC 6238 / RFC 4226, SHA-1, 6 digits, 30s step).
// Pure functions only: no Nest, no Prisma, no I/O — safe for unit tests and
// shared by AuthService (challenge issuance) and TotpService (verification).

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const TOTP_PERIOD_SEC = 30;
export const TOTP_DIGITS = 6;
export const TOTP_ALGORITHM = 'SHA1';
/** Acceptance window: codes from the previous, current, and next step verify. */
export const TOTP_WINDOW_STEPS = 1;
export const TOTP_SECRET_BYTES = 20;
/** Lifetime of the short-lived challenge token issued at password login. */
export const TOTP_TOKEN_TTL_SEC = 300;
export const TOTP_TOKEN_PURPOSE = 'totp';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Random 20-byte secret, base32-encoded without padding (for otpauth export). */
export function generateTotpSecret(bytes: number = TOTP_SECRET_BYTES): string {
  return base32Encode(randomBytes(bytes));
}

export function base32Encode(data: Uint8Array): string {
  let out = '';
  let bits = 0;
  let acc = 0;
  for (const byte of data) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(acc >>> bits) & 31];
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(acc << (5 - bits)) & 31];
  return out;
}

/**
 * Case-insensitive, padding-optional base32 decode.
 * @throws on any character outside the base32 alphabet or bad trailing length.
 */
export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  if (clean.length === 0) throw new Error('Invalid base32 secret: empty');
  if (clean.length % 8 === 1 || clean.length % 8 === 3 || clean.length % 8 === 6) {
    throw new Error('Invalid base32 secret: bad length');
  }
  for (const ch of clean) {
    if (!BASE32_ALPHABET.includes(ch)) {
      throw new Error('Invalid base32 secret: bad character');
    }
  }
  const out: number[] = [];
  let bits = 0;
  let acc = 0;
  for (const ch of clean) {
    acc = (acc << 5) | BASE32_ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

/** HOTP (RFC 4226 §5.3): HMAC-SHA1 + dynamic truncation, zero-padded. */
export function hotp(secret: Uint8Array, counter: number | bigint, digits: number = TOTP_DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', Buffer.from(secret)).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const code =
    ((mac[offset] & 0x7f) << 24) |
    (mac[offset + 1] << 16) |
    (mac[offset + 2] << 8) |
    mac[offset + 3];
  return (code % 10 ** digits).toString().padStart(digits, '0');
}

/** Current TOTP code for a base32 secret at `atMs` (default: now). */
export function totp(
  secretBase32: string,
  atMs: number = Date.now(),
  periodSec: number = TOTP_PERIOD_SEC,
  digits: number = TOTP_DIGITS,
): string {
  const counter = Math.floor(Math.floor(atMs / 1000) / periodSec);
  return hotp(base32Decode(secretBase32), counter, digits);
}

/**
 * Verify a code within ±`window` steps of `atMs`, using a constant-time
 * comparison so valid/invalid codes take the same time to reject.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  atMs: number = Date.now(),
  window: number = TOTP_WINDOW_STEPS,
  periodSec: number = TOTP_PERIOD_SEC,
  digits: number = TOTP_DIGITS,
): boolean {
  let secret: Buffer;
  try {
    secret = base32Decode(secretBase32);
  } catch {
    return false;
  }
  const step = Math.floor(Math.floor(atMs / 1000) / periodSec);
  let ok = false;
  for (let s = -window; s <= window; s++) {
    ok = safeEqual(hotp(secret, step + s, digits), code) || ok;
  }
  return ok;
}

/**
 * Constant-time string equality. Buffers are zero-padded to equal length
 * before `timingSafeEqual` (which throws on length mismatch), and the length
 * check is folded into the result so prefixes never compare equal.
 */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  const len = Math.max(ba.length, bb.length);
  const pa = Buffer.alloc(len);
  const pb = Buffer.alloc(len);
  ba.copy(pa);
  bb.copy(pb);
  return timingSafeEqual(pa, pb) && ba.length === bb.length;
}

/** otpauth:// URI for QR enrollment in authenticator apps. */
export function buildOtpauthUri(issuer: string, email: string, secret: string): string {
  return (
    `otpauth://totp/${issuer}:${email}` +
    `?secret=${secret}&issuer=${issuer}&algorithm=${TOTP_ALGORITHM}` +
    `&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SEC}`
  );
}
