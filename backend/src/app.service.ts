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
}
