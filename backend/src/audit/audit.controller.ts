import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequirePermissions, Roles } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AuditService } from './audit.service.js';
import { ListAuditQuery } from './dto.js';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('SUPER_ADMIN')
@RequirePermissions('audit:read')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() query: ListAuditQuery) {
    return this.audit.list(query);
  }

  @Get('actions')
  actionCatalog() {
    return this.audit.actions();
  }
}
