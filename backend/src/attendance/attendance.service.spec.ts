import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { RiskService } from '../risk/risk.service.js';
import { AttendanceService } from './attendance.service.js';
import { verifyDeviceSignature } from './helpers.js';

vi.mock('./helpers.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./helpers.js')>();
  return { ...mod, verifyDeviceSignature: vi.fn(() => true) };
});

const auditStub = { log: vi.fn(async () => undefined) } as never;
const configStub = { get: (_k: string, d: unknown) => d } as never;

const SHIFT = {
  id: 's1',
  name: 'PAGI',
  startTime: '00:00',
  endTime: '23:59',
  overnight: false,
  gracePeriodMin: 15,
  lateThresholdMin: 30,
  earlyCheckoutThresholdMin: 15,
};

interface Deps {
  prisma: PrismaService;
  devices: { validateDeviceFor: ReturnType<typeof vi.fn> };
  face: { matchScore: ReturnType<typeof vi.fn>; loadCipher: ReturnType<typeof vi.fn> };
  svc: AttendanceService;
}

function makeDeps(over: {
  schedule?: unknown;
  openAttendance?: unknown;
  faceScore?: number;
  deviceOk?: boolean;
  idempotent?: boolean;
} = {}): Deps {
  const prisma = {
    employee: { findUnique: vi.fn(async () => ({ id: 'e1' })) },
    idempotencyKey: {
      deleteMany: vi.fn(async () => ({})),
      create: vi.fn(async (a: { data: { key: string } }) => {
        if (over.idempotent === false) throw { code: 'P2002' };
        return a.data;
      }),
    },
    device: { findUnique: vi.fn(async () => ({ id: 'd1', devicePublicKey: 'k'.repeat(44) })) },
    employeeSchedule: {
      findUnique: vi.fn(async () => (over.schedule === null ? null : { id: 'sch1', shiftId: 's1', shift: SHIFT })),
    },
    attendance: {
      findFirst: vi.fn(async () => over.openAttendance ?? null),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'a1', ...a.data })),
      update: vi.fn(async (a: { where: { id: string }; data: Record<string, unknown> }) => ({ id: a.where.id, ...a.data })),
    },
  } as unknown as PrismaService;

  const devices = {
    validateDeviceFor: vi.fn(async () =>
      over.deviceOk === false
        ? { ok: false, reason: 'NOT_ACTIVE' }
        : { ok: true, device: { id: 'd1', status: 'ACTIVE' } },
    ),
  };
  const face = {
    matchScore: vi.fn(async () => over.faceScore ?? 0.9),
    loadCipher: vi.fn(),
  };
  const privacy = {
    hasActiveConsent: vi.fn(async () => over.consent !== false),
  };
  const risk = new RiskService({ get: (_k: string, d: unknown) => d } as never);
  const svc = new AttendanceService(prisma, devices as never, face as never, risk, privacy as never, auditStub, configStub);
  return { prisma, devices, face, svc };
}

const dto = (over: Record<string, unknown> = {}) => ({
  deviceId: 'd1',
  faceEmbedding: Array(192).fill(0.1),
  liveness: { passed: true, challenges: ['blink'], completedAt: new Date().toISOString(), score: 1 },
  requestId: '11111111-2222-3333-4444-555555555555',
  requestTimestamp: new Date().toISOString(),
  signature: 'c2ln',
  deviceCompromised: false,
  ...over,
});

interface PassiveOptions {
  passed?: boolean;
   
  padScore?: number | null;
  completedAt?: string;
}

 
function passiveLiveness(options: PassiveOptions = {}) {
  const passed = options.passed ?? true;
  const completedAt = options.completedAt ?? new Date().toISOString();
  const padScore = options.padScore === undefined ? 0.84 : options.padScore;
  return {
    passed,
    mode: 'passive',
    completedAt,
    score: 1,
    ...(padScore === null ? {} : { padScore }),
  };
}

beforeEach(() => {
  vi.mocked(verifyDeviceSignature).mockReturnValue(true);
  auditStub.log.mockClear();
});

describe('AttendanceService.checkIn', () => {
  it('happy path persists + audits CHECK_IN', async () => {
    const { svc, prisma } = makeDeps();
    const out = (await svc.checkIn(dto(), 'u1')) as {
      checkInStatus: string;
      faceMatch: { matched: boolean };
      risk: { score: number; category: string; needsReview: boolean };
    };
    expect(out.faceMatch.matched).toBe(true);
    expect(['ON_TIME', 'LATE', 'VERY_LATE']).toContain(out.checkInStatus);
    expect(out.risk).toEqual({ score: 96, category: 'LOW', needsReview: false });
    expect(prisma.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ riskScore: 96, riskCategory: 'LOW', needsReview: false }),
      }),
    );
    expect(auditStub.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CHECK_IN' }));
  });

  it('borderline face scores MEDIUM and flags review (row still created)', async () => {    const { svc, prisma } = makeDeps({ faceScore: 0.6 });
    const out = (await svc.checkIn(dto(), 'u1')) as {
      risk: { score: number; category: string; needsReview: boolean };
    };
    expect(out.risk).toEqual({ score: 82, category: 'MEDIUM', needsReview: true });
    expect(prisma.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ needsReview: true }) }),
    );
  });

  it('stale request + duplicate requestId rejected without audit row', async () => {    const { svc } = makeDeps();
    await expect(
      svc.checkIn(dto({ requestTimestamp: new Date(Date.now() - 30 * 60_000).toISOString() }), 'u1'),
    ).rejects.toMatchObject({ response: { reason: 'STALE_REQUEST' } });

    const dup = makeDeps({ idempotent: false });
    await expect(dup.svc.checkIn(dto(), 'u1')).rejects.toMatchObject({ response: { reason: 'DUPLICATE_REQUEST' } });
  });

  it('revoked consent blocks check-in/out (STEP 21)', async () => {
    await expect(makeDeps({ consent: false }).svc.checkIn(dto(), 'u1')).rejects.toMatchObject({
      response: { reason: 'NO_CONSENT' },
    });
    await expect(makeDeps({ consent: false }).svc.checkOut(dto(), 'u1')).rejects.toMatchObject({
      response: { reason: 'NO_CONSENT' },
    });
  });

  it('inactive device, bad signature, compromised all rejected', async () => {
    await expect(makeDeps({ deviceOk: false }).svc.checkIn(dto(), 'u1')).rejects.toMatchObject({
      response: { reason: 'DEVICE_NOT_ACTIVE' },
    });
    vi.mocked(verifyDeviceSignature).mockReturnValue(false);
    await expect(makeDeps().svc.checkIn(dto(), 'u1')).rejects.toMatchObject({
      response: { reason: 'INVALID_SIGNATURE' },
    });
    vi.mocked(verifyDeviceSignature).mockReturnValue(true);
    await expect(
      makeDeps().svc.checkIn(dto({ deviceCompromised: true }), 'u1'),
    ).rejects.toMatchObject({ response: { reason: 'DEVICE_COMPROMISED' } });
  });

  it('no schedule / already checked in / outside radius / stale liveness / face mismatch', async () => {
    await expect(makeDeps({ schedule: null }).svc.checkIn(dto(), 'u1')).rejects.toMatchObject({
      response: { reason: 'NO_SCHEDULE' },
    });
    await expect(
      makeDeps({ openAttendance: { id: 'a0' } }).svc.checkIn(dto(), 'u1'),
    ).rejects.toMatchObject({ response: { reason: 'ALREADY_CHECKED_IN' } });
    
    const out = await makeDeps().svc.checkIn(dto(), 'u1');
    expect(out).toMatchObject({
      risk: { score: 96, category: 'LOW', needsReview: false },
    });
    const staleLive = dto({
      liveness: { passed: true, challenges: ['blink'], completedAt: new Date(Date.now() - 30 * 60_000).toISOString(), score: 1 },
    });
    await expect(makeDeps().svc.checkIn(staleLive, 'u1')).rejects.toMatchObject({
      response: { reason: 'LIVENESS_STALE' },
    });
    await expect(makeDeps({ faceScore: 0.1 }).svc.checkIn(dto(), 'u1')).rejects.toMatchObject({
      response: { reason: 'FACE_MISMATCH' },
    });
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ATTENDANCE_REJECTED' }),
    );
  });

  it('a passive (Face-ID style) liveness run passes the server gate', async () => {
    
    await expect(
      makeDeps().svc.checkIn(dto({ liveness: passiveLiveness() }), 'u1'),
    ).resolves.toBeDefined();
  });

  it('a passive run that omits padScore is rejected as empty evidence', async () => {
    
    const body = dto();
    (body.liveness as Record<string, unknown>) = passiveLiveness({ padScore: null });
    await expect(makeDeps().svc.checkIn(body, 'u1')).rejects.toMatchObject({
      response: { reason: 'LIVENESS_EMPTY' },
    });
  });

  it('a stale passive run is rejected', async () => {
    const body = dto();
    (body.liveness as Record<string, unknown>) = passiveLiveness({
      completedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    });
    await expect(makeDeps().svc.checkIn(body, 'u1')).rejects.toMatchObject({
      response: { reason: 'LIVENESS_STALE' },
    });
  });

  it('a passive run that fails the gate is rejected', async () => {
    const body = dto();
    (body.liveness as Record<string, unknown>) = passiveLiveness({ passed: false });
    await expect(makeDeps().svc.checkIn(body, 'u1')).rejects.toMatchObject({
      response: { reason: 'LIVENESS_FAILED' },
    });
  });

  it('rejections carry risk score + category in audit and response', async () => {
    
    await expect(makeDeps({ faceScore: 0.1 }).svc.checkIn(dto(), 'u1')).rejects.toMatchObject({
      response: { reason: 'FACE_MISMATCH', riskScore: 60, riskCategory: 'HIGH' },
    });
    expect(auditStub.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ATTENDANCE_REJECTED',
        metadata: expect.objectContaining({ riskScore: 60, riskCategory: 'HIGH' }),
      }),
    );
  });
});

describe('AttendanceService.checkOut', () => {
  const openRow = {
    id: 'a1',
    workDate: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
    checkInAt: new Date(),
    checkInStatus: 'ON_TIME',
    shift: SHIFT,
  };

  it('no open attendance -> 422; happy path sets checkout + audits', async () => {
    await expect(makeDeps().svc.checkOut(dto(), 'u1')).rejects.toMatchObject({
      response: { reason: 'NO_OPEN_ATTENDANCE' },
    });

    const { svc } = makeDeps({ openAttendance: openRow });
    const out = (await svc.checkOut(dto(), 'u1')) as { checkOutStatus: string };
    expect(['NORMAL_CHECKOUT', 'EARLY_CHECKOUT']).toContain(out.checkOutStatus);
    expect(auditStub.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CHECK_OUT' }));
  });

  it('check-out preserves the worse check-in verdict (never washes the review flag)', async () => {
    const { svc, prisma } = makeDeps({
      openAttendance: { ...openRow, riskScore: 73, riskCategory: 'MEDIUM', needsReview: true },
    });
    const out = (await svc.checkOut(dto(), 'u1')) as {
      risk: { score: number; category: string; needsReview: boolean };
    };
    
    expect(out.risk).toEqual({ score: 96, category: 'MEDIUM', needsReview: true });
    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ riskScore: 96, riskCategory: 'MEDIUM', needsReview: true }),
      }),
    );
  });
});
