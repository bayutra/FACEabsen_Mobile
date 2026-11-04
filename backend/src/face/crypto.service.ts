import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { FACE_DIM } from './dto.js';

/** v1: [0x01][iv 12][tag 16][ct] — AAD binding, no key id (legacy). */
export const TEMPLATE_V1 = 0x01;
/** v2: [0x02][idLen][id][iv 12][tag 16][ct] — AAD binding + key rotation. */
export const TEMPLATE_V2 = 0x02;

const V1_OVERHEAD = 1 + 12 + 16;
const EXPECTED_PLAINTEXT_BYTES = FACE_DIM * 4;

interface KeyEntry {
  id: string;
  key: Buffer;
}

/**
 * Parse `DATA_ENCRYPTION_KEYS_PREVIOUS` values of the form `id:base64,id2:base64`.
 * Previous keys are decrypt-only so a rotation never orphans stored templates.
 */
export function parsePreviousKeys(raw: string): KeyEntry[] {
  const out: KeyEntry[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf(':');
    if (sep <= 0) throw new Error('DATA_ENCRYPTION_KEYS_PREVIOUS entry must be id:base64');
    const id = trimmed.slice(0, sep).trim();
    const key = Buffer.from(trimmed.slice(sep + 1).trim(), 'base64');
    if (!id || key.length !== 32) {
      throw new Error(
        'DATA_ENCRYPTION_KEYS_PREVIOUS entries must be id:base64 of 32 bytes',
      );
    }
    out.push({ id, key });
  }
  return out;
}

@Injectable()
export class TemplateCryptoService {
  private readonly logger = new Logger(TemplateCryptoService.name);
  private readonly active: KeyEntry;
  private readonly previous: KeyEntry[];
  private warnedLegacy = false;

  constructor(config: ConfigService) {
    const raw = config.get<string>('DATA_ENCRYPTION_KEY', '');
    const key = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
    if (key.length !== 32) {
      throw new Error(
        "DATA_ENCRYPTION_KEY must be base64 of 32 bytes (generate: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\")",
      );
    }
    const id =
      String(config.get<string>('DATA_ENCRYPTION_KEY_ID') ?? '1').trim() || '1';
    this.active = { id, key };
    this.previous = parsePreviousKeys(
      config.get<string>('DATA_ENCRYPTION_KEYS_PREVIOUS') ?? '',
    );
    if (this.previous.some((entry) => entry.id === this.active.id)) {
      throw new Error(
        'DATA_ENCRYPTION_KEYS_PREVIOUS must not repeat DATA_ENCRYPTION_KEY_ID',
      );
    }
  }

  /** Current key id, stored alongside templates so rotation is traceable. */
  get keyId(): string {
    return this.active.id;
  }

  encrypt(plain: Buffer, employeeId: string): Buffer {
    const idBytes = Buffer.from(this.active.id, 'utf8');
    if (idBytes.length === 0 || idBytes.length > 255) {
      throw new Error('DATA_ENCRYPTION_KEY_ID must be 1..255 bytes');
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.active.key, iv);
    cipher.setAAD(Buffer.from(employeeId, 'utf8'));
    const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([
      Buffer.from([TEMPLATE_V2, idBytes.length]),
      idBytes,
      iv,
      tag,
      ct,
    ]);
  }

  decrypt(blob: Buffer, employeeId?: string): Buffer {
    if (blob.length >= 2 && blob[0] === TEMPLATE_V2) {
      const idLen = blob[1];
      const id = blob.subarray(2, 2 + idLen).toString('utf8');
      const entry = this.findKey(id);
      if (!entry) {
        throw new Error(`Unknown DATA_ENCRYPTION_KEY_ID: ${id}`);
      }
      return this.open(
        blob.subarray(2 + idLen),
        entry.key,
        this.requireAad(employeeId),
      );
    }

    // v1 has no key id. A v1 template is exactly V1_OVERHEAD + plaintext bytes;
    // anything else that starts with 0x01 is a pre-v1 row whose random IV
    // happened to start with 0x01. No silent fallback after a failed v1 open.
    if (
      blob.length >= 1 &&
      blob[0] === TEMPLATE_V1 &&
      blob.length === V1_OVERHEAD + EXPECTED_PLAINTEXT_BYTES
    ) {
      const aad = this.requireAad(employeeId);
      let lastError: unknown;
      for (const entry of [this.active, ...this.previous]) {
        try {
          return this.open(blob.subarray(1), entry.key, aad);
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error('Unable to decrypt v1 face template');
    }

    if (blob.length < 28) {
      throw new Error('Face template ciphertext is malformed');
    }
    if (!this.warnedLegacy) {
      this.warnedLegacy = true;
      this.logger.warn(
        'Decrypting a pre-v1 face template; re-register the face to store it under the current key id',
      );
    }
    let lastError: unknown;
    for (const entry of [this.active, ...this.previous]) {
      try {
        return this.open(blob, entry.key, undefined);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Unable to decrypt face template');
  }

  /** True when the blob is a v2 row and can be identified without decrypting. */
  keyIdOf(blob: Buffer): string | null {
    if (blob.length < 2 || blob[0] !== TEMPLATE_V2) return null;
    return blob.subarray(2, 2 + blob[1]).toString('utf8');
  }

  private findKey(id: string): KeyEntry | undefined {
    if (id === this.active.id) return this.active;
    return this.previous.find((entry) => entry.id === id);
  }

  private requireAad(employeeId?: string): string {
    if (!employeeId) {
      throw new Error('employeeId (AAD) is required for face templates');
    }
    return employeeId;
  }

  private open(payload: Buffer, key: Buffer, aad?: string): Buffer {
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const ct = payload.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    if (aad !== undefined) decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }
}
