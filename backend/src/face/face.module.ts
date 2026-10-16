import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrivacyModule } from '../privacy/privacy.module.js';
import { TemplateCryptoService } from './crypto.service.js';
import { FaceController } from './face.controller.js';
import { FaceService } from './face.service.js';

@Module({
  imports: [AuthModule, PrivacyModule],
  controllers: [FaceController],
  providers: [FaceService, TemplateCryptoService],
  exports: [FaceService],
})
export class FaceModule {}
