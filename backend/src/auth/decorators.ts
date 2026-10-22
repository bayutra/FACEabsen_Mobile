import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:public';
export const ROLES_KEY = 'auth:roles';
export const PERMS_KEY = 'auth:permissions';

 
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

 
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

 
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
