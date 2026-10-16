import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health() {
    return this.appService.health();
  }

  /** Liveness probe (L4): no DB. Readiness stays on `GET /health`. */
  @Get('health/live')
  live() {
    return this.appService.live();
  }
}
