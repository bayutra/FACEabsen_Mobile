import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser, RequirePermissions, Roles, type AuthContext } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { HandoversService } from './handovers.service.js';
import { AcknowledgeHandoverDto, CreateHandoverDto, ListHandoversQuery } from './dto.js';

@UseGuards(JwtAuthGuard)
@Controller('handovers')
export class HandoversController {
  constructor(private readonly handovers: HandoversService) {}

  @Post()
  create(
    @Body() dto: CreateHandoverDto,
    @CurrentUser() user: AuthContext,
    @Req() req: Request,
  ) {
    return this.handovers.create(dto, user.userId, { ip: req.ip });
  }

  @Get()
  list(@Query() query: ListHandoversQuery, @CurrentUser() user: AuthContext) {
    return this.handovers.list(user.userId, user.roles, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.handovers.findOne(id, user.userId, user.roles);
  }

  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('SUPERVISOR')
  @RequirePermissions('handover:acknowledge:team')
  @HttpCode(HttpStatus.OK)
  @Post(':id/acknowledge')
  acknowledge(
    @Param('id') id: string,
    @Body() dto: AcknowledgeHandoverDto,
    @CurrentUser() user: AuthContext,
    @Req() req: Request,
  ) {
    return this.handovers.acknowledge(id, user.userId, user.roles, dto.note, { ip: req.ip });
  }
}
