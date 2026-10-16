import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import { satisfiesRole } from '../auth/rbac.js';
import { resolveHospitalScope } from '../auth/tenant-scope.js';
import { DevicesService } from '../devices/devices.service.js';
import { FaceService } from '../face/face.service.js';
import { GeoService } from '../geo/geo.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrivacyService } from '../privacy/privacy.service.js';
import { IntegrityService } from '../integrity/integrity.service.js';
import { RiskService, type RiskInput } from '../risk/risk.service.js';
import { evaluateCheckIn, evaluateCheckOut } from '../shifts/shift-time.js';
import type { AdminHistoryQuery, CheckInDto, CheckOutDto, MyHistoryQuery } from './dto.js';
import {
  assertTimeZone,
  buildSignMessage,
  hospitalWorkDate,
  validateLiveness,
  verifyDeviceSignature,
} from './helpers.js';

/**
 * STEP 12 — Attendance engine (PRD §21, §57) + STEP 13 risk scoring.
 * Every signal is verified server-side; any gate failure rejects WITHOUT
 * writing an attendance row (but WITH a scored ATTENDANCE_REJECTED audit).
 * Successful rows carry riskScore/riskCategory; MEDIUM is flagged for
 * supervisor review (queue UI: STEP 17).
 */
@Injectable()
export class AttendanceService {
  private readonly faceThreshold: number;
  private readonly livenessMaxAgeMin: number;
  private readonly requestSkewMin: number;
  private readonly hospitalTz: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly devices: DevicesService,
    private readonly geo: GeoService,
    private readonly face: FaceService,
    private readonly risk: RiskService,
    private readonly privacy: PrivacyService,
    private readonly audit: AuditService,
    config: ConfigService,
    @Optional() private readonly integrity?: IntegrityService,
  ) {
    this.faceThreshold = Number(config.get('FACE_MATCH_THRESHOLD', 0.5));
    this.livenessMaxAgeMin = Number(config.get('LIVENESS_MAX_AGE_MIN', 10));
    this.requestSkewMin = Number(config.get('REQUEST_MAX_SKEW_MIN', 5));
    const tz = config.get('HOSPITAL_TZ', 'Asia/Jakarta') || 'Asia/Jakarta';
    assertTimeZone(tz);
    this.hospitalTz = tz;
  }

  async checkIn(dto: CheckInDto, userId: string, meta: { ip?: string } = {}) {
    const now = new Date();
    const employee = await this.requireEmployee(userId);
    const risk = blankRisk(false);
    await this.claimRequest(dto, now, userId, meta, risk);
    await this.requireConsent(employee.id, userId, meta, risk);

    const device = await this.requireDevice(employee.id, dto.deviceId, userId, meta, risk);
    risk.deviceOk = true;
    await this.requireSignature(device, dto, userId, meta, risk);
    risk.signatureOk = true;
    this.applyIntegrity(dto, device.platform, userId, meta, risk);
    await this.rejectIfBadIntegrity(userId, meta, risk);

    const { key: workKey, date: workDate } = hospitalWorkDate(now, this.hospitalTz);
    const schedule = await this.prisma.employeeSchedule.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
      include: { shift: true },
    });
    if (!schedule) {
      return this.reject(userId, 'NO_SCHEDULE', 'Tidak ada jadwal hari ini', meta, risk, { workDate: workKey });
    }

    const open = await this.prisma.attendance.findFirst({
      where: { employeeId: employee.id, checkOutAt: null },
      orderBy: { checkInAt: 'desc' },
    });
    if (open) {
      return this.reject(userId, 'ALREADY_CHECKED_IN', 'Sudah check-in, selesaikan check-out dulu', meta, risk, { openId: open.id });
    }

    const geo = await this.geo.check(
      {
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyM: dto.accuracyM,
        timestamp: dto.fixTimestamp,
        isMocked: dto.isMocked,
      },
      userId,
    );
    risk.gpsOk = geo.checks.coordsValid && geo.checks.accuracyOk && geo.checks.timestampFresh;
    risk.geofenceOk = geo.inside;
    if (!geo.inside) {
      return this.reject(userId, 'OUTSIDE_GEOFENCE', 'Di luar radius / GPS tidak valid', meta, risk, {
        distanceM: geo.distanceM,
        checks: geo.checks,
        mockSuspected: geo.mockSuspected,
      });
    }

    const live = validateLiveness(dto.liveness, now, this.livenessMaxAgeMin);
    if (!live.ok) {
      return this.reject(userId, live.reason, 'Bukti liveness tidak valid', meta, risk);
    }
    risk.livenessOk = true;

    const match = await this.matchFace(employee.id, dto.faceEmbedding);
    risk.faceScore = match.score < 0 ? 0 : match.score;
    if (!match.matched) {
      return this.reject(userId, match.reason, 'Verifikasi wajah gagal', meta, risk, { score: match.score });
    }

    const verdict = this.risk.score(risk);
    const flagged = this.risk.needsReview(verdict.category);
    const evalIn = evaluateCheckIn(now, workKey, schedule.shift, this.hospitalTz);
    const row = await this.prisma.attendance.create({
      data: {
        employeeId: employee.id,
        shiftId: schedule.shiftId,
        scheduleId: schedule.id,
        workDate,
        checkInAt: now,
        checkInStatus: evalIn.status,
        deviceId: device.id,
        checkInLat: dto.latitude,
        checkInLon: dto.longitude,
        checkInAccuracy: dto.accuracyM,
        geofencePass: true,
        riskScore: verdict.score,
        riskCategory: verdict.category,
        needsReview: flagged,
      },
    });
    await this.audit.log({
      actorId: userId,
      action: 'CHECK_IN',
      targetType: 'attendance',
      targetId: row.id,
      ipAddress: meta.ip,
      deviceId: device.id,
      metadata: { status: evalIn.status, lateMinutes: evalIn.lateMinutes, matchScore: match.score, distanceM: geo.distanceM, riskScore: verdict.score, riskCategory: verdict.category },
    });
    return {
      id: row.id,
      workDate: workKey,
      checkInAt: row.checkInAt,
      checkInStatus: row.checkInStatus,
      shift: { name: schedule.shift.name, window: `${schedule.shift.startTime} → ${schedule.shift.endTime}` },
      geofence: { inside: true, distanceM: geo.distanceM, radiusM: geo.radiusM },
      faceMatch: { score: match.score, matched: true },
      risk: { score: verdict.score, category: verdict.category, needsReview: flagged },
    };
  }

  async checkOut(dto: CheckOutDto, userId: string, meta: { ip?: string } = {}) {
    const now = new Date();
    const employee = await this.requireEmployee(userId);
    const risk = blankRisk(false);
    await this.claimRequest(dto, now, userId, meta, risk);
    await this.requireConsent(employee.id, userId, meta, risk);

    const device = await this.requireDevice(employee.id, dto.deviceId, userId, meta, risk);
    risk.deviceOk = true;
    await this.requireSignature(device, dto, userId, meta, risk);
    risk.signatureOk = true;
    this.applyIntegrity(dto, device.platform, userId, meta, risk);
    await this.rejectIfBadIntegrity(userId, meta, risk);

    const open = await this.prisma.attendance.findFirst({
      where: { employeeId: employee.id, checkOutAt: null },
      orderBy: { checkInAt: 'desc' },
      include: { shift: true },
    });
    if (!open) {
      return this.reject(userId, 'NO_OPEN_ATTENDANCE', 'Belum check-in', meta, risk);
    }

    const geo = await this.geo.check(
      {
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyM: dto.accuracyM,
        timestamp: dto.fixTimestamp,
        isMocked: dto.isMocked,
      },
      userId,
    );
    risk.gpsOk = geo.checks.coordsValid && geo.checks.accuracyOk && geo.checks.timestampFresh;
    risk.geofenceOk = geo.inside;
    if (!geo.inside) {
      return this.reject(userId, 'OUTSIDE_GEOFENCE', 'Di luar radius / GPS tidak valid', meta, risk, {
        distanceM: geo.distanceM,
        checks: geo.checks,
      });
    }

    const live = validateLiveness(dto.liveness, now, this.livenessMaxAgeMin);
    if (!live.ok) {
      return this.reject(userId, live.reason, 'Bukti liveness tidak valid', meta, risk);
    }
    risk.livenessOk = true;

    const match = await this.matchFace(employee.id, dto.faceEmbedding);
    risk.faceScore = match.score < 0 ? 0 : match.score;
    if (!match.matched) {
      return this.reject(userId, match.reason, 'Verifikasi wajah gagal', meta, risk, { score: match.score });
    }

    const verdict = this.risk.score(risk);
    const flaggedOut = this.risk.needsReview(verdict.category);
    const workKey = open.workDate.toISOString().slice(0, 10);
    const evalOut = evaluateCheckOut(now, workKey, open.shift, this.hospitalTz);
    // Preserve the check-in verdict: the stored score/category/flag is the
    // WORSE of the two punches, so a suspicious check-in can never be washed
    // clean by an uneventful check-out (and vanish from the review queue).
    const score = Math.max(open.riskScore ?? 0, verdict.score);
    const category = worseCategory(open.riskCategory, verdict.category);
    const flagged = (open.needsReview ?? false) || flaggedOut;
    const row = await this.prisma.attendance.update({
      where: { id: open.id },
      data: {
        checkOutAt: now,
        checkOutStatus: evalOut.status,
        checkOutLat: dto.latitude,
        checkOutLon: dto.longitude,
        riskScore: score,
        riskCategory: category,
        needsReview: flagged,
      },
    });
    await this.audit.log({
      actorId: userId,
      action: 'CHECK_OUT',
      targetType: 'attendance',
      targetId: row.id,
      ipAddress: meta.ip,
      deviceId: device.id,
      metadata: { status: evalOut.status, earlyMinutes: evalOut.earlyMinutes, matchScore: match.score, riskScore: score, riskCategory: category },
    });
    return {
      id: row.id,
      workDate: workKey,
      checkInAt: row.checkInAt,
      checkInStatus: row.checkInStatus,
      checkOutAt: row.checkOutAt,
      checkOutStatus: row.checkOutStatus,
      faceMatch: { score: match.score, matched: true },
      risk: { score, category, needsReview: flagged },
    };
  }

  // ---------- history (STEP 14) ----------

  async listMine(userId: string, query: MyHistoryQuery) {
    const employee = await this.requireEmployee(userId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const AND: Array<Record<string, unknown>> = [{ employeeId: employee.id }];
    if (query.from) AND.push({ workDate: { gte: new Date(query.from) } });
    if (query.to) AND.push({ workDate: { lte: new Date(query.to) } });
    if (query.checkInStatus) AND.push({ checkInStatus: query.checkInStatus });
    const where = { AND };
    // GPS evidence for the mobile detail sheet (PRD §16: prove where the punch
    // happened). Latitude/longitude/accuracy are already stored per row.
    const evidenceSelect = {
      checkInLat: true,
      checkInLon: true,
      checkInAccuracy: true,
      geofencePass: true,
    } as const;
    const [total, rows] = await Promise.all([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.findMany({
        where,
        orderBy: [{ workDate: 'desc' }, { checkInAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          workDate: true,
          checkInAt: true,
          checkOutAt: true,
          checkInStatus: true,
          checkOutStatus: true,
          riskScore: true,
          riskCategory: true,
          needsReview: true,
          ...evidenceSelect,
          shift: { select: { id: true, name: true, startTime: true, endTime: true, overnight: true } },
        },
      }),
    ]);
    return {
      data: rows,
      pagination: { page, pageSize, totalItems: total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async listAll(query: AdminHistoryQuery, userId: string, roles: string[]) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const AND: Array<Record<string, unknown>> = [];
    // Facility scoping: ADMIN callers only see their own hospital. The
    // department filter is verified against the caller's facility instead
    // of being trusted (department ids are enumerable via /departments).
    if (!satisfiesRole(roles, 'SUPER_ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital') return emptyPage(page, pageSize);
      if (query.departmentId) {
        const dept = await this.prisma.department.findUnique({
          where: { id: query.departmentId },
          select: { hospitalId: true },
        });
        if (!dept || dept.hospitalId !== scope.hospitalId) return emptyPage(page, pageSize);
      }
      AND.push({ employee: { department: { hospitalId: scope.hospitalId } } });
    }
    if (query.employeeId) AND.push({ employeeId: query.employeeId });
    if (query.departmentId) AND.push({ employee: { departmentId: query.departmentId } });
    if (query.from) AND.push({ workDate: { gte: new Date(query.from) } });
    if (query.to) AND.push({ workDate: { lte: new Date(query.to) } });
    if (query.checkInStatus) AND.push({ checkInStatus: query.checkInStatus });
    if (query.riskCategory) AND.push({ riskCategory: query.riskCategory });
    if (query.needsReview !== undefined) AND.push({ needsReview: query.needsReview });
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      AND.push({ employee: { OR: [{ name: contains }, { employeeNo: contains }] } });
    }
    const where = AND.length > 0 ? { AND } : {};
    const [total, rows] = await Promise.all([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.findMany({
        where,
        orderBy: [{ workDate: 'desc' }, { checkInAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          shift: { select: { id: true, name: true, startTime: true, endTime: true } },
          employee: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);
    return {
      data: rows,
      pagination: { page, pageSize, totalItems: total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getOne(id: string, userId: string, roles: string[]) {
    const row = await this.prisma.attendance.findUnique({
      where: { id },
      include: {
        shift: true,
        employee: {
          select: {
            id: true,
            userId: true,
            name: true,
            employeeNo: true,
            department: { select: { id: true, name: true, hospitalId: true } },
          },
        },
        device: { select: { id: true, deviceName: true, platform: true } },
      },
    });
    if (!row) throw new NotFoundException('Attendance not found');
    const owner = row.employee.userId === userId;
    if (owner || satisfiesRole(roles, 'SUPER_ADMIN')) return row;
    // ADMIN is facility-scoped: a row from another hospital reads as 404
    // (same shape as "not found" so facility ids stay unenumerable).
    if (satisfiesRole(roles, 'ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind === 'hospital' && row.employee?.department?.hospitalId === scope.hospitalId) {
        return row;
      }
    }
    throw new NotFoundException('Attendance not found');
  }

  // ---------- gates ----------

  private async requireEmployee(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('No employee profile for this account');
    return employee;
  }

  private async requireConsent(employeeId: string, userId: string, meta: { ip?: string }, risk: RiskInput) {
    if (await this.privacy.hasActiveConsent(employeeId, 'BIOMETRIC_ATTENDANCE')) return;
    return this.reject(userId, 'NO_CONSENT', 'Persetujuan biometrik diperlukan', meta, risk);
  }

  private async claimRequest(
    dto: { requestId: string; requestTimestamp: string },
    now: Date,
    userId: string,
    meta: { ip?: string },
    risk: RiskInput,
  ) {
    const ts = new Date(dto.requestTimestamp);
    if (Number.isNaN(ts.getTime()) || Math.abs(now.getTime() - ts.getTime()) > this.requestSkewMin * 60_000) {
      return this.reject(userId, 'STALE_REQUEST', 'Request kedaluwarsa', meta, risk);
    }
    await this.prisma.idempotencyKey.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - 60 * 60_1000) } },
    });
    try {
      await this.prisma.idempotencyKey.create({ data: { key: dto.requestId } });
    } catch (e) {
      if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002') {
        await this.denyAudit(userId, 'DUPLICATE_REQUEST', meta, risk, { requestId: dto.requestId });
        throw new ConflictException({ reason: 'DUPLICATE_REQUEST', message: 'Request sudah diproses' });
      }
      throw e;
    }
  }

  private async requireDevice(
    employeeId: string,
    deviceId: string,
    userId: string,
    meta: { ip?: string },
    risk: RiskInput,
  ) {
    const check = await this.devices.validateDeviceFor(employeeId, deviceId);
    if (!check.ok) {
      if (check.reason === 'UNKNOWN_DEVICE') {
        await this.denyAudit(userId, 'UNKNOWN_DEVICE', meta, risk, { deviceId });
        throw new NotFoundException('Device tidak dikenal');
      }
      if (check.reason === 'WRONG_OWNER') {
        await this.denyAudit(userId, 'WRONG_OWNER_DEVICE', meta, risk, { deviceId });
        throw new ForbiddenException('Device bukan milik akun ini');
      }
      return this.reject(userId, 'DEVICE_NOT_ACTIVE', 'Device tidak aktif', meta, risk, { deviceId });
    }
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      await this.denyAudit(userId, 'UNKNOWN_DEVICE', meta, risk, { deviceId });
      throw new NotFoundException('Device tidak dikenal');
    }
    return device;
  }

  private async requireSignature(
    device: { devicePublicKey: string },
    dto: { requestId: string; requestTimestamp: string; signature: string },
    userId: string,
    meta: { ip?: string },
    risk: RiskInput,
  ) {
    const ok = verifyDeviceSignature(
      device.devicePublicKey,
      buildSignMessage(dto.requestId, dto.requestTimestamp),
      dto.signature,
    );
    if (!ok) {
      return this.reject(userId, 'INVALID_SIGNATURE', 'Tanda tangan device tidak valid', meta, risk);
    }
  }

  private applyIntegrity(
    dto: { deviceCompromised: boolean; integrityToken?: string },
    platform: string,
    _userId: string,
    _meta: { ip?: string },
    risk: RiskInput,
  ) {
    if (!this.integrity) {
      // Pre-integrity wiring fallback (unit doubles): legacy jailbreak claim.
      risk.integrityOk = !dto.deviceCompromised;
      (risk as unknown as Record<string, unknown>).__integrityReason = dto.deviceCompromised ? 'MISSING_TOKEN' : undefined;
      return;
    }
    const resolved = this.integrity.resolveSignal({
      integrityToken: dto.integrityToken,
      deviceCompromised: dto.deviceCompromised,
      platform,
    });
    risk.integrityOk = resolved.ok;
    (risk as unknown as Record<string, unknown>).__integrityReason =
      resolved.verdict && !resolved.verdict.ok ? resolved.verdict.reason : undefined;
  }

  private async rejectIfBadIntegrity(
    userId: string,
    meta: { ip?: string },
    risk: RiskInput,
  ): Promise<void> {
    if (risk.integrityOk) return;
    const strict = this.integrity?.strictMode ?? false;
    const reason = (risk as unknown as Record<string, unknown>).__integrityReason as string | undefined;
    if (reason === 'MISSING_TOKEN' && !strict) {
      // Lax legacy path: jailbreak claim already folded into integrityOk=false
      // only when compromised; reaching here means compromised without token.
      return this.reject(userId, 'DEVICE_COMPROMISED', 'Perangkat terindikasi kompromi', meta, risk);
    }
    return this.reject(userId, 'INTEGRITY_FAILED', 'Verifikasi integritas perangkat gagal', meta, risk, {
      integrityReason: reason ?? 'UNTRUSTED',
    });
  }

  /** Audit-only denial (preserves the original HTTP shape of the caller). */
  private async denyAudit(
    userId: string,
    reason: string,
    meta: { ip?: string },
    risk: RiskInput,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const verdict = this.risk.score(risk);
    await this.audit.log({
      actorId: userId,
      action: 'ATTENDANCE_REJECTED',
      ipAddress: meta.ip,
      result: 'DENIED',
      metadata: { reason, riskScore: verdict.score, riskCategory: verdict.category, ...extra },
    });
  }

  private async matchFace(
    employeeId: string,
    live: number[],
  ): Promise<{ matched: true; score: number } | { matched: false; reason: 'NO_FACE_TEMPLATE' | 'FACE_MISMATCH'; score: number }> {
    if (!live.every((v) => Number.isFinite(v))) {
      return { matched: false, reason: 'FACE_MISMATCH', score: -1 };
    }
    const score = await this.face.matchScore(employeeId, live);
    if (score === null) return { matched: false, reason: 'NO_FACE_TEMPLATE', score: -1 };
    return score >= this.faceThreshold
      ? { matched: true, score: round3(score) }
      : { matched: false, reason: 'FACE_MISMATCH', score: round3(score) };
  }

  private async reject(
    userId: string,
    reason: string,
    message: string,
    meta: { ip?: string },
    risk: RiskInput,
    extra: Record<string, unknown> = {},
  ): Promise<never> {
    const verdict = this.risk.score(risk);
    await this.audit.log({
      actorId: userId,
      action: 'ATTENDANCE_REJECTED',
      ipAddress: meta.ip,
      result: 'DENIED',
      metadata: { reason, riskScore: verdict.score, riskCategory: verdict.category, ...extra },
    });
    throw new UnprocessableEntityException({ reason, message, riskScore: verdict.score, riskCategory: verdict.category });
  }
}

function emptyPage(page: number, pageSize: number) {
  return { data: [], pagination: { page, pageSize, totalItems: 0, totalPages: 0 } };
}

/** Worse of two risk categories (null-safe: a missing verdict never wins). */
function worseCategory(
  a: string | null | undefined,
  b: 'LOW' | 'MEDIUM' | 'HIGH',
): 'LOW' | 'MEDIUM' | 'HIGH' {
  const rank = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
  const ra = a === 'LOW' || a === 'MEDIUM' || a === 'HIGH' ? rank[a] : -1;
  return ra >= rank[b] ? (a as 'LOW' | 'MEDIUM' | 'HIGH') : b;
}

function blankRisk(integrityOk: boolean): RiskInput {
  return {
    faceScore: null,
    livenessOk: false,
    deviceOk: false,
    integrityOk,
    gpsOk: false,
    geofenceOk: false,
    signatureOk: false,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
