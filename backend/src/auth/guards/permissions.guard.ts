import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service.js';
import { PERMS_KEY } from '../decorators.js';
import { hasAllPermissions } from '../rbac.js';

 
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const authCtx = context.switchToHttp().getRequest().auth;
    if (!authCtx) throw new ForbiddenException('Forbidden');
    const granted = await this.auth.getPermissions(authCtx.userId);
    if (!hasAllPermissions(granted, required)) {
      throw new ForbiddenException('Forbidden');
    }
    return true;
  }
}
