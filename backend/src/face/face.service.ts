import * as argon2 from 'argon2';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrivacyService } from '../privacy/privacy.service.js';
import { TemplateCryptoService } from './crypto.service.js';
import { FACE_DIM, MIN_QUALITY, type RegisterFaceDto } from './dto.js';
import { cosineSimilarity } from '../attendance/helpers.js';

@Injectable()
export class FaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: TemplateCryptoService,
    private readonly privacy: PrivacyService,
    private readonly audit: AuditService,
  ) {}

  async register(
    dto: RegisterFaceDto,
    userId: string,
    meta: { ip?: string } = {},
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee)
      throw new NotFoundException('No employee profile for this account');
    if (
      !(await this.privacy.hasActiveConsent(
        employee.id,
        'BIOMETRIC_ATTENDANCE',
      ))
    ) {
      throw new UnprocessableEntityException({
        reason: 'NO_CONSENT',
        message: 'Persetujuan biometrik diperlukan',
      });
    }
    if (!dto.template.every((v) => Number.isFinite(v))) {
      throw new BadRequestException(
        'Template must contain only finite numbers',
      );
    }
    if (dto.qualityScore < MIN_QUALITY) {
      throw new BadRequestException(`Quality too low (minimum ${MIN_QUALITY})`);
    }

    const existing = await this.prisma.faceTemplate.findUnique({
      where: { employeeId: employee.id },
    });

    if (existing) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });
      const ok = dto.currentPassword
        ? await argon2.verify(user?.passwordHash ?? '', dto.currentPassword)
        : false;
      if (!ok) {
        throw new ForbiddenException({
          reason: 'REAUTH_FAILED',
          message: 'Kata sandi diperlukan untuk mengganti wajah',
        });
      }
    }

    const floats = Float32Array.from(dto.template);
    const cipher = toBytes(
      this.crypto.encrypt(Buffer.from(floats.buffer), employee.id),
    );

    let similarity: number | null = null;
    if (existing) {
      try {
        const oldBuf = this.crypto.decrypt(
          Buffer.from(existing.templateCipher),
          employee.id,
        );
        const oldFloats = new Float32Array(
          oldBuf.buffer,
          oldBuf.byteOffset,
          oldBuf.byteLength / 4,
        );
        similarity = cosineSimilarity(oldFloats, floats);
      } catch {
        similarity = null;
      }
    }

    const row = existing
      ? await this.prisma.faceTemplate.update({
          where: { employeeId: employee.id },
          data: {
            templateCipher: cipher,
            algorithm: dto.algorithm ?? existing.algorithm,
            version: existing.version + 1,
            qualityScore: dto.qualityScore,
          },
        })
      : await this.prisma.faceTemplate.create({
          data: {
            employeeId: employee.id,
            templateCipher: cipher,
            algorithm: dto.algorithm ?? 'MobileFaceNet_v1',
            qualityScore: dto.qualityScore,
          },
        });

    await this.audit.log({
      actorId: userId,
      action: existing ? 'FACE_UPDATED' : 'FACE_REGISTERED',
      targetType: 'face_template',
      targetId: row.id,
      ipAddress: meta.ip,
      deviceId: (meta as any).deviceId,
      metadata: {
        version: row.version,
        qualityScore: dto.qualityScore,
        similarity: similarity == null ? null : Math.round(similarity * 1000) / 1000,
      },
    });
    return { registered: true, version: row.version, updatedAt: row.updatedAt };
  }

  async status(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee)
      throw new NotFoundException('No employee profile for this account');
    const row = await this.prisma.faceTemplate.findUnique({
      where: { employeeId: employee.id },
    });
    if (!row) return { registered: false };
    return {
      registered: true,
      version: row.version,
      algorithm: row.algorithm,
      qualityScore: row.qualityScore,
      updatedAt: row.updatedAt,
    };
  }

  async loadCipher(employeeId: string): Promise<Buffer | null> {
    const row = await this.prisma.faceTemplate.findUnique({
      where: { employeeId },
    });
    return row ? Buffer.from(row.templateCipher) : null;
  }

  async matchScore(employeeId: string, live: number[]): Promise<number | null> {
    const blob = await this.loadCipher(employeeId);
    if (!blob) return null;
    const plain = this.crypto.decrypt(blob, employeeId);
    const stored = new Float32Array(
      plain.buffer,
      plain.byteOffset,
      plain.byteLength / 4,
    );
    if (stored.length !== live.length || stored.length === 0) return -1;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < stored.length; i++) {
      dot += stored[i] * live[i];
      na += stored[i] * stored[i];
      nb += live[i] * live[i];
    }
    if (na === 0 || nb === 0) return -1;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }
}

export { FACE_DIM };

function toBytes(buf: Uint8Array): Uint8Array<ArrayBuffer> {
  if (buf.buffer instanceof ArrayBuffer) {
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const copy = new Uint8Array(buf.byteLength);
  copy.set(buf);
  return copy;
}
