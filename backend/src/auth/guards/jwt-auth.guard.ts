import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AUTH_POLICY } from '../constants.js';
import { IS_PUBLIC_KEY } from '../decorators.js';

interface AccessPayload {
  sub: string;
  email: string;
  roles: string[];
  sid: string;
}

 
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const header: string = req.headers?.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: AccessPayload;
    try {
      
      payload = await this.jwt.verifyAsync<AccessPayload>(token, {
        algorithms: [AUTH_POLICY.jwtAlgorithm],
        issuer: AUTH_POLICY.jwtIssuer,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (!payload?.sub || !payload?.sid) {
      throw new UnauthorizedException('Malformed access token');
    }

    const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or revoked');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account inactive');
    }

    req.auth = {
      userId: user.id,
      email: user.email,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      sessionId: session.id,
    };
    return true;
  }
}
