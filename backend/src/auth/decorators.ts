import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:public';
export const ROLES_KEY = 'auth:roles';
export const PERMS_KEY = 'auth:permissions';

/** Skip JwtAuthGuard (login, refresh). Everything else is authenticated by default. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Any-of semantics: at least one role required. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** All listed permissions required (resource:action). */
export const RequirePermissions = (...perms: string[]) => SetMetadata(PERMS_KEY, perms);

export interface AuthContext {
  userId: string;
  email: string;
  roles: string[];
  sessionId: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    return ctx.switchToHttp().getRequest().auth as AuthContext;
  },
);
