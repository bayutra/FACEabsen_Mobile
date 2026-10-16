import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  /** Liveness + DB readiness for compose healthchecks and monitoring. */
  async health(): Promise<{ status: string; db: string; uptimeSec: number }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up', uptimeSec: Math.floor(process.uptime()) };
    } catch {
      return { status: 'degraded', db: 'down', uptimeSec: Math.floor(process.uptime()) };
    }
  }

  /**
   * Liveness only (L4): no DB checkout, so a saturated/dead database never
   * takes the liveness probe down with it. Readiness stays on `GET /health`,
   * which docker-compose and scripts/smoke-api.sh depend on.
   */
  live(): { status: string } {
    return { status: 'ok' };
  }
}
