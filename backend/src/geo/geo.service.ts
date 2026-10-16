import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { satisfiesRole } from '../auth/rbac.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { GeoCheckDto } from './dto.js';
import { validateFix, type GeoVerdict } from './geo.math.js';

/**
 * STEP 11 — geofence validation (PRD §15-§17, §56).
 * Stateless per-check verdict; movement plausibility (impossible travel)
 * needs consecutive fixes and belongs to the risk engine (STEP 13).
 */
@Injectable()
export class GeoService {
  private readonly maxAccuracyM: number;
  private readonly maxSkewMin: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.maxAccuracyM = Number(config.get('GEO_MAX_ACCURACY_M', 50));
    this.maxSkewMin = Number(config.get('GEO_MAX_SKEW_MIN', 5));
  }

  /**
   * The configured punch point and radius for every facility.
   *
   * Read-only: the fence is seeded per hospital and this service exposes no
   * write path. Exists so the admin console can show where each facility's
   * geofence actually sits instead of guessing from a probe result.
   */
  async fences() {
    const rows = await this.prisma.hospital.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, latitude: true, longitude: true, radiusMeters: true },
    });
    return rows.map((h) => ({
      id: h.id,
      code: h.code,
      name: h.name,
      latitude: h.latitude,
      longitude: h.longitude,
      radiusMeters: h.radiusMeters,
      maxAccuracyM: this.maxAccuracyM,
      maxSkewMin: this.maxSkewMin,
    }));
  }

  /**
   * SUPER_ADMIN perimeter edit. Writes through to the hospital row and logs
   * GEOFENCE_UPDATED (before/after) so the change itself is auditable.
   */
  async updateFence(
    hospitalId: string,
    dto: { latitude: number; longitude: number; radiusMeters: number },
    actorId: string,
    ip?: string,
  ) {
    const existing = await this.prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!existing) throw new NotFoundException('Hospital not found');
    const updated = await this.prisma.hospital.update({
      where: { id: hospitalId },
      data: { latitude: dto.latitude, longitude: dto.longitude, radiusMeters: dto.radiusMeters },
      select: { id: true, code: true, name: true, latitude: true, longitude: true, radiusMeters: true },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'GEOFENCE_UPDATED',
        targetType: 'hospital',
        targetId: hospitalId,
        ipAddress: ip ?? null,
        metadata: {
          before: { latitude: existing.latitude, longitude: existing.longitude, radiusMeters: existing.radiusMeters },
          after: { latitude: dto.latitude, longitude: dto.longitude, radiusMeters: dto.radiusMeters },
        },
        result: 'SUCCESS',
      },
    });
    return { ...updated, maxAccuracyM: this.maxAccuracyM, maxSkewMin: this.maxSkewMin };
  }

  async check(dto: GeoCheckDto, userId: string, roles: string[] = []) {
    const hospital = await this.resolveHospital(dto.hospitalId, userId, roles);
    const verdict: GeoVerdict = validateFix(
      {
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyM: dto.accuracyM,
        timestamp: new Date(dto.timestamp),
        isMocked: dto.isMocked,
      },
      { latitude: hospital.latitude, longitude: hospital.longitude, radiusM: hospital.radiusMeters },
      { maxAccuracyM: this.maxAccuracyM, maxSkewMin: this.maxSkewMin },
    );
    return {
      inside: verdict.inside,
      distanceM: Math.round(verdict.distanceM * 10) / 10,
      radiusM: verdict.radiusM,
      mockSuspected: verdict.mockSuspected,
      checks: verdict.checks,
      hospital: { id: hospital.id, code: hospital.code, name: hospital.name },
    };
  }

  /**
   * Facility resolution (M4): the client `hospitalId` override is honored ONLY
   * for SUPER_ADMIN. For everyone else it is ignored and the caller's own
   * department hospital is used, so one employee cannot read another
   * facility's exact fence coordinates. The DTO field stays (mobile clients
   * still send it) — it is simply not trusted here.
   */
  private async resolveHospital(hospitalId: string | undefined, userId: string, roles: string[]) {
    if (hospitalId && satisfiesRole(roles, 'SUPER_ADMIN')) {
      const h = await this.prisma.hospital.findUnique({ where: { id: hospitalId } });
      if (!h) throw new NotFoundException('Hospital not found');
      return h;
    }
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { department: { include: { hospital: true } } },
    });
    const hospital = employee?.department?.hospital;
    if (!hospital) throw new NotFoundException('No hospital assigned to this account');
    return hospital;
  }
}
