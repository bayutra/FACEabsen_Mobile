import type { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { canAssignRole, highestRoleRank, satisfiesRole } from '../auth/rbac.js';
import { resolveHospitalScope } from '../auth/tenant-scope.js';
import { validatePasswordPolicy } from '../auth/password.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateUserDto,
  ListUsersQuery,
  ResetPasswordDto,
  UpdateUserDto,
} from './dto.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listUsers(query: ListUsersQuery, userId: string, roles: string[]) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const AND: Prisma.UserWhereInput[] = [];

    if (!satisfiesRole(roles, 'SUPER_ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital') {
        return {
          data: [],
          pagination: { page, pageSize, totalItems: 0, totalPages: 0 },
        };
      }
      AND.push({
        OR: [
          { employee: { department: { hospitalId: scope.hospitalId } } },
          { employee: { is: null } },
        ],
      });
    }

    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      AND.push({
        OR: [
          { email: contains },
          { employee: { is: { name: contains } } },
          { employee: { is: { employeeNo: contains } } },
        ],
      });
    }
    if (query.isActive !== undefined) AND.push({ isActive: query.isActive });
    if (query.role)
      AND.push({ userRoles: { some: { role: { name: query.role } } } });

    const where: Prisma.UserWhereInput = AND.length > 0 ? { AND } : {};

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { email: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          isActive: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          createdAt: true,
          userRoles: { select: { role: { select: { name: true } } } },
          employee: {
            select: {
              employeeNo: true,
              name: true,
              status: true,
              department: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((u) => ({
        ...u,
        roles: u.userRoles.map((r) => r.role.name),
        userRoles: undefined,
      })),
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async createUser(
    dto: CreateUserDto,
    actorId: string,
    meta: { ip?: string } = {},
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    validatePasswordPolicy(dto.password);

    const actorRoles = await this.getRoles(actorId);
    const roles = this.assertGrantable(actorRoles, dto.roles);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash: await argon2.hash(dto.password),
          },
          select: { id: true, email: true, isActive: true },
        });
        await this.assignRoles(tx, user.id, roles);
        await this.audit.log(
          {
            actorId,
            action: 'USER_CREATED',
            targetType: 'user',
            targetId: user.id,
            ipAddress: meta.ip,
            metadata: { email: dto.email, roles },
          },
          tx,
        );
        return { ...user, roles };
      });
    } catch (e) {
      throw this.mapUnique(e);
    }
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    actorId: string,
    meta: { ip?: string } = {},
  ) {
    const target = await this.loadManageable(id, actorId);
    const actorRoles = await this.getRoles(actorId);

    if (dto.isActive === false && id === actorId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    if (dto.roles && id === actorId) {
      throw new BadRequestException('You cannot change your own roles');
    }
    if (dto.roles) {
      const next = this.assertGrantable(actorRoles, dto.roles);

      if (next.length === 0)
        throw new BadRequestException('At least one role is required');
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.roles) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await this.assignRoles(tx, id, dto.roles);
      }
      if (dto.isActive !== undefined) {
        await tx.user.update({
          where: { id },
          data: {
            isActive: dto.isActive,

            ...(dto.isActive
              ? { failedLoginAttempts: 0, lockedUntil: null }
              : {}),
          },
        });
      }
      if (dto.isActive === false) {
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit.log(
        {
          actorId,
          action: 'USER_UPDATED',
          targetType: 'user',
          targetId: id,
          ipAddress: meta.ip,
          metadata: {
            email: target.email,
            ...(dto.roles ? { roles: dto.roles } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          },
        },
        tx,
      );
    });

    const roles = dto.roles ?? (await this.getRoles(id));
    return {
      id,
      email: target.email,
      isActive: dto.isActive ?? target.isActive,
      roles,
    };
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    actorId: string,
    meta: { ip?: string } = {},
  ) {
    const target = await this.loadManageable(id, actorId);
    validatePasswordPolicy(dto.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash: await argon2.hash(dto.password),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log(
        {
          actorId,
          action: 'USER_PASSWORD_RESET',
          targetType: 'user',
          targetId: id,
          ipAddress: meta.ip,
          metadata: { email: target.email },
        },
        tx,
      );
    });

    return { reset: true };
  }

  private async loadManageable(id: string, actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, isActive: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (id !== actorId) {
      const [actorRoles, targetRoles] = await Promise.all([
        this.getRoles(actorId),
        this.getRoles(id),
      ]);
      if (!actorRoles.includes('SUPER_ADMIN')) {
        if (highestRoleRank(targetRoles) >= highestRoleRank(actorRoles)) {
          throw new ForbiddenException(
            'Cannot administer an account at or above your own rank',
          );
        }

        const [targetEmp, scope] = await Promise.all([
          this.prisma.employee.findUnique({
            where: { userId: id },
            include: { department: { select: { hospitalId: true } } },
          }),
          resolveHospitalScope(this.prisma, actorId, actorRoles),
        ]);
        const targetHospital = targetEmp?.department?.hospitalId;
        if (
          targetHospital &&
          (scope.kind !== 'hospital' || scope.hospitalId !== targetHospital)
        ) {
          throw new NotFoundException('User not found');
        }
      }
    }
    return user;
  }

  private assertGrantable(actorRoles: string[], requested?: string[]) {
    const roles = [...new Set(['EMPLOYEE', ...(requested ?? [])])];
    for (const role of roles) {
      if (!canAssignRole(actorRoles, role)) {
        throw new ForbiddenException(`Not allowed to grant role ${role}`);
      }
    }
    return roles;
  }

  private async assignRoles(
    tx: Prisma.TransactionClient,
    userId: string,
    roles: string[],
  ) {
    for (const name of roles) {
      const role = await tx.role.findUnique({ where: { name } });
      if (!role) throw new NotFoundException(`Role ${name} not found`);
      await tx.userRole.create({ data: { userId, roleId: role.id } });
    }
  }

  private async getRoles(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { name: true } } },
    });
    return rows.map((r) => r.role.name);
  }

  private mapUnique(e: unknown): unknown {
    if (
      typeof e === 'object' &&
      e !== null &&
      (e as { code?: string }).code === 'P2002'
    ) {
      return new ConflictException('Email already in use');
    }
    return e;
  }
}
