import { Module } from '@nestjs/common';
import { IntegrityService } from './integrity.service.js';

@Module({
  providers: [IntegrityService],
  exports: [IntegrityService],
})
export class IntegrityModule {}
