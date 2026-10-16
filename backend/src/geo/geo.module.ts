import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GeoController } from './geo.controller.js';
import { GeoService } from './geo.service.js';

@Module({
  imports: [AuthModule],
  controllers: [GeoController],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
