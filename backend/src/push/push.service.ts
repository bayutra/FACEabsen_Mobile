import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  FcmClient,
  type FcmSendResult,
  type PushPayload,
} from './fcm.client.js';

export type RegisterPushTokenInput = {
  token: string;
  installationId?: string;
};

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmClient,
  ) {}

  async registerToken(
    input: RegisterPushTokenInput,
    userId: string,
  ): Promise<{ registered: true }> {
    const device = await this.prisma.device.findFirst({
      where: {
        employee: { userId },
        status: 'ACTIVE',
        ...(input.installationId
          ? { installationId: input.installationId }
          : {}),
      },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, platform: true },
    });
    if (!device) {
      throw new NotFoundException(
        'No active device registered for this account',
      );
    }

    const existing = await this.prisma.pushToken.findUnique({
      where: { token: input.token },
      select: { deviceId: true },
    });
    if (existing && existing.deviceId !== device.id) {
      throw new ConflictException(
        'Push token is already registered to another device',
      );
    }

    await this.prisma.$transaction([
      this.prisma.pushToken.deleteMany({
        where: { deviceId: device.id, token: { not: input.token } },
      }),
      this.prisma.pushToken.upsert({
        where: { token: input.token },
        create: {
          deviceId: device.id,
          token: input.token,
          platform: device.platform,
        },
        update: {
          deviceId: device.id,
          platform: device.platform,
          lastSeenAt: new Date(),
        },
      }),
    ]);

    return { registered: true };
  }

  async unregisterToken(
    token: string,
    userId: string,
  ): Promise<{ removed: number }> {
    const result = await this.prisma.pushToken.deleteMany({
      where: { token, device: { employee: { userId } } },
    });
    return { removed: result.count };
  }

  sendToUser(userId: string, payload: PushPayload): Promise<FcmSendResult> {
    return this.sendToWhere(
      { device: { employee: { userId }, status: 'ACTIVE' } },
      payload,
    );
  }

  sendToEmployee(
    employeeId: string,
    payload: PushPayload,
  ): Promise<FcmSendResult> {
    return this.sendToWhere(
      { device: { employeeId, status: 'ACTIVE' } },
      payload,
    );
  }

  /**
   * Fire-and-forget delivery used by business flows (corrections, leave,
   * device replacement). Failures are logged by the delivery path and never
   * propagate to the request that triggered the notification.
   */
  notifyEmployee(employeeId: string, payload: PushPayload): void {
    void this.sendToEmployee(employeeId, payload);
  }

  private async sendToWhere(
    where: Prisma.PushTokenWhereInput,
    payload: PushPayload,
  ): Promise<FcmSendResult> {
    let tokens: { token: string }[];
    try {
      tokens = await this.prisma.pushToken.findMany({
        where,
        select: { token: true },
      });
    } catch (error) {
      // Notification delivery must never break the business operation that
      // triggered it (approving a correction, replacing a device, ...).
      this.logger.warn(
        `Push token lookup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { sent: 0, failed: 0, skipped: true, invalidTokens: [] };
    }
    if (tokens.length === 0) {
      return { sent: 0, failed: 0, skipped: true, invalidTokens: [] };
    }

    try {
      const result = await this.fcm.sendMulticast(
        tokens.map((row) => row.token),
        payload,
      );
      if (result.invalidTokens.length > 0) {
        await this.prisma.pushToken.deleteMany({
          where: { token: { in: result.invalidTokens } },
        });
      }
      return result;
    } catch (error) {
      this.logger.warn(
        `Push delivery failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        sent: 0,
        failed: tokens.length,
        skipped: false,
        invalidTokens: [],
      };
    }
  }
}
