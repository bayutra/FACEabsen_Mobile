import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// STEP 3: database access foundation. No business logic here.
//
// NOTE: connects lazily on first query (no eager $connect) so the app can
// boot for smoke tests without a live DB. A startup DB check + /health
// readiness probe arrive with production hardening (STEP 22/25).
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
