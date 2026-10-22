import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators.js';
import { satisfiesRole } from '../rbac.js';

 
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const auth = context.switchToHttp().getRequest().auth;
    if (!auth) throw new ForbiddenException('Forbidden');
    const ok = required.some((r) => satisfiesRole(auth.roles ?? [], r));
    if (!ok) throw new ForbiddenException('Forbidden');
    return true;
  }
}
