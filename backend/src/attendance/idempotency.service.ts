import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class IdempotencyService {
  private lastPurge = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private retentionHours(): number {
    const v = Number(this.config.get('IDEMPOTENCY_RETENTION_HOURS', 25));
    return Number.isFinite(v) && v >= 25 ? v : 25;
  }

  async begin(input: {
    requestId: string;
    employeeId: string;
    action: 'check-in' | 'check-out';
  }): Promise<{ mode: 'new' } | { mode: 'replay'; response: unknown }> {
    const key = `request:${input.requestId}`;
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          kind: 'request',
          employeeId: input.employeeId,
          action: input.action,
        },
      });
      return { mode: 'new' };
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err;
      const row = await this.prisma.idempotencyKey.findUnique({ where: { key } });
      if (!row) throw err;
      if (row.employeeId && row.employeeId !== input.employeeId) {
        throw new ConflictException({
          reason: 'REQUEST_OWNER_MISMATCH',
          message: 'Request milik karyawan lain',
        });
      }
      if (row.responseJson != null) {
        return { mode: 'replay', response: row.responseJson };
      }
      throw new ConflictException({
        reason: 'REQUEST_IN_PROGRESS',
        message: 'Request sedang diproses',
      });
    }
  }

  async complete(requestId: string, response: unknown): Promise<void> {
    await this.prisma.idempotencyKey.update({
      where: { key: `request:${requestId}` },
      data: { responseJson: response as any },
    });
  }

  async release(requestId: string): Promise<void> {
    await this.prisma.idempotencyKey.deleteMany({
      where: { key: `request:${requestId}` },
    });
  }

  async maybePurge(now: Date = new Date()): Promise<void> {
    if (now.getTime() - this.lastPurge < 3600_000) return;
    this.lastPurge = now.getTime();
    const cutoff = new Date(now.getTime() - this.retentionHours() * 3600_000);
    await this.prisma.idempotencyKey.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
  }
}