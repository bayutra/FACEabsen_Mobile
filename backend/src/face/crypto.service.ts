import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * STEP 9 — face template encryption (PRD §13). AES-256-GCM with per-row IV;
 * key comes ONLY from DATA_ENCRYPTION_KEY (base64, 32 bytes). No fallback —
 * fail-closed if misconfigured. M11: new rows are a versioned envelope
 * (0x01 || iv || tag || ct) with AAD = employeeId; legacy rows (iv|tag|ct,
 * no AAD) still decrypt via the legacy path.
 */
@Injectable()
export class TemplateCryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('DATA_ENCRYPTION_KEY', '');
    const key = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
    if (key.length !== 32) {
      throw new Error(
        'DATA_ENCRYPTION_KEY must be base64 of 32 bytes (generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))")',
      );
    }
    this.key = key;
  }

  encrypt(plain: Buffer, employeeId: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(employeeId, 'utf8'));
    const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([Buffer.from([0x01]), iv, tag, ct]); // 0x01 | iv(12) | tag(16) | ct
  }

  decrypt(blob: Buffer, employeeId?: string): Buffer {
    // M11: versioned envelope. 0x01 → AAD-bound (employeeId); anything else
    // is a legacy row (iv | tag | ct, no AAD) decrypted exactly as before.
    // A legacy IV starts with 0x01 with p=1/256 — those rows fail the v1
    // auth check and fall through to the legacy path below, so no stored
    // row ever becomes undecryptable. A genuine v1 mismatch fails BOTH
    // paths (the shifted legacy parse never authenticates).
    if (blob.length > 0 && blob[0] === 0x01) {
      if (!employeeId) throw new Error('employeeId (AAD) is required for v1 face templates');
      try {
        const iv = blob.subarray(1, 13);
        const tag = blob.subarray(13, 29);
        const ct = blob.subarray(29);
        const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
        decipher.setAAD(Buffer.from(employeeId, 'utf8'));
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ct), decipher.final()]);
      } catch {
        // Fall through to the legacy parse.
      }
    }
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(12, 28);
    const ct = blob.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }
}
