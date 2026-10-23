import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private secret(): string {
    return this.config.get('EMAIL_CODE_SECRET', this.config.get('JWT_ACCESS_SECRET', 'dev-only-secret'));
  }

  private hashCode(code: string): string {
    return createHmac('sha256', this.secret()).update(code).digest('hex');
  }

  async issue(userId: string, email: string): Promise<void> {
    await this.prisma.emailVerificationCode.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = this.hashCode(code);
    await this.prisma.emailVerificationCode.create({
      data: {
        userId,
        codeHash,
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });
    await this.email.sendVerificationCode(email, code);
  }

  async verify(email: string, code: string): Promise<{ userId: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException({ reason: 'INVALID_CODE', message: 'Kode tidak valid' });
    }
    const row = await this.prisma.emailVerificationCode.findFirst({
      where: { userId: user.id, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!row || row.expiresAt < new Date() || row.attempts >= 5) {
      throw new BadRequestException({ reason: 'INVALID_CODE', message: 'Kode tidak valid' });
    }
    const hash = this.hashCode(code);
    const ok =
      row.codeHash.length === hash.length &&
      timingSafeEqual(Buffer.from(row.codeHash, 'hex'), Buffer.from(hash, 'hex'));
    if (!ok) {
      await this.prisma.emailVerificationCode.update({
        where: { id: row.id },
        data: { attempts: row.attempts + 1 },
      });
      throw new BadRequestException({ reason: 'INVALID_CODE', message: 'Kode tidak valid' });
    }
    await this.prisma.emailVerificationCode.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
    await this.audit.log({
      actorId: user.id,
      action: 'EMAIL_VERIFIED',
      targetType: 'user',
      targetId: user.id,
    });
    return { userId: user.id };
  }
}