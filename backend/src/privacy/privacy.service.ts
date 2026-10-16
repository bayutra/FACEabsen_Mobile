import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PRIVACY_NOTICE_ID } from './notice.js';

/**
 * STEP 21 — Privacy & PDP foundations (PRD §66).
 * Consent gates biometric USE (face register + attendance matching).
 * Retention purges expired operational data; biometric erasure on demand.
 * Every privacy action is audited.
 */
@Injectable()
export class PrivacyService {
  private readonly sessionRetentionDays: number;
  private readonly faceInactiveRetentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.sessionRetentionDays = Number(config.get('RETENTION_SESSION_DAYS', 30));
    this.faceInactiveRetentionDays = Number(config.get('RETENTION_FACE_INACTIVE_DAYS', 90));
  }

  notice() {
    return PRIVACY_NOTICE_ID;
  }

  async grantOrRevoke(userId: string, purpose: string, granted: boolean, meta: { ip?: string } = {}, version?: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('No employee profile for this account');

    const noticeVersion = version?.trim() ? version!.trim() : PRIVACY_NOTICE_ID.version;
    const existing = await this.prisma.consent.findUnique({
      where: { employeeId_purpose: { employeeId: employee.id, purpose } },
    });
    const row = existing
      ? await this.prisma.consent.update({
          where: { id: existing.id },
          data: granted
            ? { grantedAt: new Date(), revokedAt: null, version: noticeVersion }
            : { revokedAt: new Date() },
        })
      : await this.prisma.consent.create({
          data: {
            employeeId: employee.id,
            purpose,
            version: noticeVersion,
            grantedAt: new Date(),
            revokedAt: granted ? null : new Date(),
          },
        });
    await this.audit.log({
      actorId: userId,
      action: granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
      targetType: 'consent',
      targetId: row.id,
      ipAddress: meta.ip,
      metadata: { purpose, version: row.version },
    });
    return { purpose, granted, version: row.version };
  }

  async myConsents(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) return [];
    return this.prisma.consent.findMany({ where: { employeeId: employee.id } });
  }

  async hasActiveConsent(employeeId: string, purpose: string): Promise<boolean> {
    const row = await this.prisma.consent.findUnique({
      where: { employeeId_purpose: { employeeId, purpose } },
    });
    return !!row && row.revokedAt === null;
  }

  /** Portable self-data export (access right). Never includes template bytes. */
  async exportMine(userId: string, meta: { ip?: string } = {}) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { department: true, user: { select: { id: true, email: true, isActive: true } } },
    });
    if (!employee) throw new NotFoundException('No employee profile for this account');
    const [devices, attendance, consents, face] = await Promise.all([
      this.prisma.device.findMany({ where: { employeeId: employee.id } }),
      this.prisma.attendance.findMany({ where: { employeeId: employee.id }, orderBy: { workDate: 'desc' }, take: 1000 }),
      this.prisma.consent.findMany({ where: { employeeId: employee.id } }),
      this.prisma.faceTemplate.findUnique({ where: { employeeId: employee.id } }),
    ]);
    await this.audit.log({ actorId: userId, action: 'DATA_EXPORTED', ipAddress: meta.ip });
    return {
      exportedAt: new Date().toISOString(),
      profile: employee,
      devices: devices.map((d) => ({ ...d, devicePublicKey: '[redacted]' })),
      attendance,
      consents,
      faceRegistered: !!face,
    };
  }

  /** Deletes own face template (erasure). Attendance history is retained. */
  async eraseFace(userId: string, meta: { ip?: string } = {}) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('No employee profile for this account');
    await this.prisma.faceTemplate.deleteMany({ where: { employeeId: employee.id } });
    await this.audit.log({ actorId: userId, action: 'FACE_DELETED', targetType: 'face_template', ipAddress: meta.ip });
    return { deleted: true };
  }

  /** Retention sweep (SUPER_ADMIN, system:manage). Returns purge counts. */
  async runRetention(adminId: string, meta: { ip?: string } = {}) {
    const now = new Date();
    const sessionCutoff = new Date(now.getTime() - this.sessionRetentionDays * 86_400_000);
    const faceCutoff = new Date(now.getTime() - this.faceInactiveRetentionDays * 86_400_000);

    const sessions = await this.prisma.session.deleteMany({
      where: { OR: [{ revokedAt: { lt: sessionCutoff } }, { expiresAt: { lt: sessionCutoff } }] },
    });
    const idem = await this.prisma.idempotencyKey.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - 24 * 3_600_000) } },
    });
    const staleFaces = await this.prisma.faceTemplate.findMany({
      where: { employee: { status: 'INACTIVE' }, updatedAt: { lt: faceCutoff } },
    });
    let faces = 0;
    for (const f of staleFaces) {
      await this.prisma.faceTemplate.delete({ where: { id: f.id } });
      faces++;
    }
    await this.audit.log({
      actorId: adminId,
      action: 'RETENTION_RUN',
      ipAddress: meta.ip,
      metadata: { sessions: sessions.count, idempotencyKeys: idem.count, faceTemplates: faces },
    });
    return { sessions: sessions.count, idempotencyKeys: idem.count, faceTemplates: faces };
  }
}
