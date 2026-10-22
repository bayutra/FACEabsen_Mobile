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

 
export const SECURITY_ACTIONS = [
  'LOGIN_FAILED',
  'ATTENDANCE_REJECTED',
  'DEVICE_REVOKED',
  'DEVICE_MARKED_LOST',
  'PASSWORD_CHANGED',
  'FACE_UPDATED',
  'EMPLOYEE_DEACTIVATED',
] as const;

 
export type AuditWriter = Pick<PrismaService, 'auditLog'>;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

   
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
