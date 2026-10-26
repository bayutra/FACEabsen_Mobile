import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async health(): Promise<{ status: string; db: string; uptimeSec: number }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        db: 'up',
        uptimeSec: Math.floor(process.uptime()),
      };
    } catch {
      return {
        status: 'degraded',
        db: 'down',
        uptimeSec: Math.floor(process.uptime()),
      };
    }
  }

  live(): { status: string } {
    return { status: 'ok' };
  }

  appConfig(): {
    minVersion: string;
    latestVersion: string;
    message: string;
  } {
    const minVersion = process.env.APP_MIN_VERSION?.trim() || '1.0.0';
    const latestVersion =
      process.env.APP_LATEST_VERSION?.trim() || minVersion;
    return {
      minVersion,
      latestVersion,
      message:
        process.env.APP_UPDATE_MESSAGE?.trim() ||
        'Versi aplikasi Anda sudah tidak didukung. Silakan perbarui aplikasi untuk melanjutkan presensi.',
    };
  }
}
