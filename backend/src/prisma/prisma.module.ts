import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

// Global DB access; imported by feature modules starting STEP 3.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
