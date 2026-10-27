import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { FcmClient } from './fcm.client.js';
import { PushService } from './push.service.js';

function prismaStub(over: Record<string, Record<string, unknown>> = {}) {
  return {
    device: {
      findFirst: vi.fn(async () => ({ id: 'd1', platform: 'ANDROID' })),
      ...over.device,
    },
    pushToken: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      upsert: vi.fn(async () => ({})),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      ...over.pushToken,
    },
    $transaction: vi.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  } as unknown as PrismaService;
}

function fcmStub(result?: Record<string, unknown>) {
  return {
    sendMulticast: vi.fn(async () => ({
      sent: 1,
      failed: 0,
      skipped: false,
      invalidTokens: [],
      ...result,
    })),
  } as unknown as FcmClient;
}

const payload = {
  title: 'Koreksi disetujui',
  body: 'Pengajuan Anda sudah diproses.',
  data: { type: 'correction', id: 'c1' },
};

describe('PushService.registerToken', () => {
  it('binds a token to the active device owned by the user', async () => {
    const prisma = prismaStub();
    const service = new PushService(prisma, fcmStub());

    await expect(
      service.registerToken(
        { token: 'fcm-token-1', installationId: 'inst-1' },
        'u1',
      ),
    ).resolves.toEqual({ registered: true });

    expect(prisma.device.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          employee: { userId: 'u1' },
          status: 'ACTIVE',
          installationId: 'inst-1',
        },
      }),
    );
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { deviceId: 'd1', token: { not: 'fcm-token-1' } },
    });
    expect(prisma.pushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'fcm-token-1' },
        create: expect.objectContaining({
          deviceId: 'd1',
          token: 'fcm-token-1',
          platform: 'ANDROID',
        }),
      }),
    );
  });

  it('rejects token registration when the user has no active device', async () => {
    const prisma = prismaStub({
      device: { findFirst: vi.fn(async () => null) },
    });
    const service = new PushService(prisma, fcmStub());

    await expect(
      service.registerToken({ token: 'fcm-token-1' }, 'u1'),
    ).rejects.toThrow('No active device');
  });

  it('refuses a token already bound to another device', async () => {
    const prisma = prismaStub({
      pushToken: {
        findUnique: vi.fn(async () => ({ deviceId: 'other-device' })),
      },
    });
    const service = new PushService(prisma, fcmStub());

    await expect(
      service.registerToken({ token: 'fcm-token-1' }, 'u1'),
    ).rejects.toThrow('already registered');
    expect(prisma.pushToken.upsert).not.toHaveBeenCalled();
  });
});

describe('PushService.unregisterToken', () => {
  it('only removes a token that belongs to the user device', async () => {
    const prisma = prismaStub({
      pushToken: {
        deleteMany: vi.fn(async () => ({ count: 1 })),
      },
    });
    const service = new PushService(prisma, fcmStub());

    await expect(service.unregisterToken('fcm-token-1', 'u1')).resolves.toEqual(
      { removed: 1 },
    );
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: 'fcm-token-1', device: { employee: { userId: 'u1' } } },
    });
  });
});

describe('PushService delivery', () => {
  it('sends to every active token for a user', async () => {
    const prisma = prismaStub({
      pushToken: {
        findMany: vi.fn(async () => [{ token: 'token-1' }, { token: 'token-2' }]),
      },
    });
    const fcm = fcmStub({ sent: 2 });
    const service = new PushService(prisma, fcm);

    const result = await service.sendToUser('u1', payload);

    expect(prisma.pushToken.findMany).toHaveBeenCalledWith({
      where: { device: { employee: { userId: 'u1' }, status: 'ACTIVE' } },
      select: { token: true },
    });
    expect(fcm.sendMulticast).toHaveBeenCalledWith(
      ['token-1', 'token-2'],
      payload,
    );
    expect(result.sent).toBe(2);
  });

  it('prunes tokens rejected by FCM', async () => {
    const prisma = prismaStub({
      pushToken: {
        findMany: vi.fn(async () => [{ token: 'stale-token' }]),
      },
    });
    const fcm = fcmStub({
      sent: 0,
      failed: 1,
      invalidTokens: ['stale-token'],
    });
    const service = new PushService(prisma, fcm);

    const result = await service.sendToEmployee('e1', payload);

    expect(result.invalidTokens).toEqual(['stale-token']);
    expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['stale-token'] } },
    });
  });

  it('never throws when FCM is unavailable', async () => {
    const prisma = prismaStub({
      pushToken: { findMany: vi.fn(async () => [{ token: 'token-1' }]) },
    });
    const fcm = {
      sendMulticast: vi.fn(async () => {
        throw new Error('network down');
      }),
    } as unknown as FcmClient;
    const service = new PushService(prisma, fcm);

    await expect(service.sendToUser('u1', payload)).resolves.toEqual({
      sent: 0,
      failed: 1,
      skipped: false,
      invalidTokens: [],
    });
  });

  it('skips delivery when the user has no active token', async () => {
    const prisma = prismaStub();
    const fcm = fcmStub();
    const service = new PushService(prisma, fcm);

    await expect(service.sendToUser('u1', payload)).resolves.toEqual({
      sent: 0,
      failed: 0,
      skipped: true,
      invalidTokens: [],
    });
    expect(fcm.sendMulticast).not.toHaveBeenCalled();
  });
});
