import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListAuditQuery } from './dto.js';

export interface AuditEvent {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  ipAddress?: string | null;
  deviceId?: string | null;
  metadata?: Prisma.InputJsonValue;
  result?: string;
}

/**
 * Security-relevant actions feed (PRD §41). Granular *_FAILED variants from
 * PRD §30 materialize as ATTENDANCE_REJECTED rows with a reason in metadata.
 */
export const SECURITY_ACTIONS = [
  'LOGIN_FAILED',
  'ATTENDANCE_REJECTED',
  'DEVICE_REVOKED',
  'DEVICE_MARKED_LOST',
  'PASSWORD_CHANGED',
  'FACE_UPDATED',
  'EMPLOYEE_DEACTIVATED',
] as const;

/** Anything that can create an AuditLog row (client or an interactive tx). */
export type AuditWriter = Pick<PrismaService, 'auditLog'>;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fail-closed: audit write errors propagate so silent gaps are impossible.
   *
   * IMPORTANT: propagating keeps the HTTP call failing, but a plain `log()`
   * called *after* a data write still leaves that write committed. Pass the
   * transaction client of the surrounding `$transaction` instead so the data
   * write and its audit row commit or roll back together.
   */
  async log(event: AuditEvent, client?: AuditWriter): Promise<void> {
    const target = client ?? this.prisma;
    await target.auditLog.create({
      data: {
        actorId: event.actorId ?? null,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        ipAddress: event.ipAddress,
        deviceId: event.deviceId,
        metadata: event.metadata ?? undefined,
        result: event.result ?? 'SUCCESS',
      },
    });
  }

  /** Read-only viewer query. No update/delete API exists by design. */
  async list(query: ListAuditQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const AND: Prisma.AuditLogWhereInput[] = [];
    if (query.security) {
      AND.push({ action: { in: [...SECURITY_ACTIONS] } });
    } else if (query.action) {
      AND.push({ action: query.action });
    }
    if (query.actorId) AND.push({ actorId: query.actorId });
    if (query.actorEmail) {
      AND.push({ actor: { email: { contains: query.actorEmail, mode: 'insensitive' } } });
    }
    if (query.targetType) AND.push({ targetType: query.targetType });
    if (query.targetId) AND.push({ targetId: query.targetId });
    if (query.result) AND.push({ result: query.result });
    if (query.from) AND.push({ timestamp: { gte: new Date(query.from) } });
    if (query.to) AND.push({ timestamp: { lte: new Date(query.to) } });
    const where = AND.length > 0 ? { AND } : {};

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actor: { select: { id: true, email: true } },
          device: { select: { id: true, deviceName: true } },
        },
      }),
    ]);
    return {
      data: rows,
      pagination: { page, pageSize, totalItems: total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async actions(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    return rows.map((r) => r.action);
  }
}
