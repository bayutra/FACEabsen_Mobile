import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DeviceChangeController } from './device-change.controller.js';
import { DeviceChangeService } from './device-change.service.js';
import { DevicesController } from './devices.controller.js';
import { DevicesService } from './devices.service.js';

@Module({
  imports: [AuthModule],
  controllers: [DevicesController, DeviceChangeController],
  providers: [DevicesService, DeviceChangeService],
  exports: [DevicesService, DeviceChangeService],
})
export class DevicesModule {}
