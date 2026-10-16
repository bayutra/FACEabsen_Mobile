import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { GeoService } from './geo.service.js';

const configStub = { get: (_k: string, d: unknown) => d } as never;
const hospital = { id: 'h1', code: 'RS-A', name: 'RS', latitude: -7.65, longitude: 112.23, radiusMeters: 100 };
const foreign = { id: 'h2', code: 'RS-B', name: 'RS Tetangga', latitude: -7.0, longitude: 112.0, radiusMeters: 100 };

function makePrisma() {
  const hospitals: Record<string, unknown> = { h1: hospital, h2: foreign };
  return {
    hospital: { findUnique: vi.fn(async (a: { where: { id: string } }) => hospitals[a.where.id] ?? null) },
    employee: {
      findUnique: vi.fn(async () => ({ id: 'e1', department: { hospital } })),
    },
  } as unknown as PrismaService;
}

const fix = () => ({
  latitude: -7.65,
  longitude: 112.23,
  accuracyM: 10,
  timestamp: new Date().toISOString(),
  isMocked: false,
});

describe('GeoService.check (STEP 23 coverage)', () => {
  it('resolves department hospital by default; honors explicit override', async () => {
    const prisma = makePrisma();
    const svc = new GeoService(prisma, configStub);
    const ok = (await svc.check(fix(), 'u1')) as { inside: boolean; hospital: { code: string } };
    expect(ok.inside).toBe(true);
    expect(ok.hospital.code).toBe('RS-A');

    const svc2 = new GeoService(prisma, configStub);
    const over = (await svc2.check({ ...fix(), hospitalId: 'h1' }, 'u1')) as { inside: boolean };
    expect(over.inside).toBe(true);
  });

  it('unknown hospital and unassigned account 404', async () => {
    const prisma = makePrisma();
    prisma.hospital.findUnique = vi.fn(async () => null);
    await expect(
      new GeoService(prisma, configStub).check({ ...fix(), hospitalId: 'hx' }, 'u1', ['SUPER_ADMIN']),
    ).rejects.toThrow('Hospital not found');
    const prisma2 = makePrisma();
    prisma2.employee.findUnique = vi.fn(async () => null);
    await expect(new GeoService(prisma2, configStub).check(fix(), 'ghost')).rejects.toThrow(
      'No hospital assigned',
    );
  });

  // M4 — the client hospitalId override must not leak another facility's
  // fence to a non-SUPER_ADMIN caller: it is ignored server-side.
  it('cross-facility override is ignored for EMPLOYEE and ADMIN', async () => {
    const prisma = makePrisma();
    for (const roles of [['EMPLOYEE'], ['ADMIN']]) {
      const svc = new GeoService(prisma, configStub);
      const out = (await svc.check({ ...fix(), hospitalId: 'h2' }, 'u1', roles)) as {
        inside: boolean;
        hospital: { code: string };
      };
      expect(out.inside).toBe(true);
      expect(out.hospital.code).toBe('RS-A');
    }
    // The foreign fence was never even looked up.
    expect(prisma.hospital.findUnique).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN keeps the explicit override', async () => {
    const prisma = makePrisma();
    const svc = new GeoService(prisma, configStub);
    const out = (await svc.check(
      { ...fix(), latitude: -7.0, longitude: 112.0, hospitalId: 'h2' },
      'u-sa',
      ['SUPER_ADMIN'],
    )) as { inside: boolean; hospital: { code: string } };
    expect(out.inside).toBe(true);
    expect(out.hospital.code).toBe('RS-B');
  });
});

describe('GeoService.updateFence (SUPER_ADMIN perimeter edit)', () => {
  function makeWritable() {
    const prisma = makePrisma();
    const audits: Array<{ data: Record<string, unknown> }> = [];
    const writable = prisma as unknown as Record<string, Record<string, unknown>>;
    writable['hospital'] = {
      ...(writable['hospital'] as object),
      update: async (a: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: a.where.id,
        code: 'RS-A',
        name: 'RS',
        ...a.data,
      }),
    };
    writable['auditLog'] = {
      create: async (a: { data: Record<string, unknown> }) => {
        audits.push(a);
        return a.data;
      },
    };
    return { prisma, audits };
  }

  it('writes the new perimeter and audits before/after', async () => {
    const { prisma, audits } = makeWritable();
    const svc = new GeoService(prisma, configStub);
    const out = (await svc.updateFence(
      'h1',
      { latitude: -7.66, longitude: 112.24, radiusMeters: 150 },
      'u-sa',
      '10.0.0.1',
    )) as Record<string, unknown>;
    expect(out['latitude']).toBe(-7.66);
    expect(out['radiusMeters']).toBe(150);
    expect(audits).toHaveLength(1);
    expect(audits[0].data).toMatchObject({
      actorId: 'u-sa',
      action: 'GEOFENCE_UPDATED',
      targetType: 'hospital',
      targetId: 'h1',
      result: 'SUCCESS',
    });
  });

  it('404 on unknown hospital and writes no audit row', async () => {
    const { prisma, audits } = makeWritable();
    prisma.hospital.findUnique = (async () => null) as never;
    await expect(
      new GeoService(prisma, configStub).updateFence(
        'hx',
        { latitude: -7.66, longitude: 112.24, radiusMeters: 150 },
        'u-sa',
      ),
    ).rejects.toThrow('Hospital not found');
    expect(audits).toHaveLength(0);
  });
});
