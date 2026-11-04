import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service.js';
import { canAssignRole, highestRoleRank, satisfiesRole } from '../auth/rbac.js';
import { resolveHospitalScope } from '../auth/tenant-scope.js';
import { validatePasswordPolicy } from '../auth/password.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateEmployeeDto,
  ListEmployeesQuery,
  UpdateEmployeeDto,
  UpdateMyProfileDto,
} from './dto.js';
import {
  assertSameFacility,
  mapUniqueError,
  rolesOf,
} from './support.js';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateEmployeeDto,
    actorId: string,
    meta: { ip?: string } = {},
  ) {
    await this.assertUnique(null, dto.email, dto.employeeNo);
    if (dto.departmentId)
      await this.assertDepartmentInFacility(dto.departmentId, actorId);
    if (dto.supervisorId)
      await this.assertSupervisorInFacility(dto.supervisorId, actorId);
    validatePasswordPolicy(dto.password);

    const roles = [...new Set(['EMPLOYEE', ...(dto.roles ?? [])])];
    const actorRoles = await rolesOf(this.prisma, actorId);
    for (const role of roles) {
      if (!canAssignRole(actorRoles, role)) {
        throw new ForbiddenException(`Not allowed to grant role ${role}`);
      }
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash: await argon2.hash(dto.password),
        },
      });
      for (const role of roles) {
        const roleRow = await this.prisma.role.findUnique({
          where: { name: role },
        });
        if (!roleRow) throw new NotFoundException(`Role ${role} not found`);
        await this.prisma.userRole.create({
          data: { userId: user.id, roleId: roleRow.id },
        });
      }
      const employee = await this.prisma.employee.create({
        data: {
          userId: user.id,
          employeeNo: dto.employeeNo,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          position: dto.position,
          departmentId: dto.departmentId,
          supervisorId: dto.supervisorId,
        },
      });
      await this.audit.log({
        actorId,
        action: 'EMPLOYEE_CREATED',
        targetType: 'employee',
        targetId: employee.id,
        ipAddress: meta.ip,
        metadata: { employeeNo: dto.employeeNo, email: dto.email, roles },
      });
      return this.loadOne(employee.id);
    } catch (e) {
      throw mapUniqueError(e);
    }
  }

  async findAll(query: ListEmployeesQuery, userId: string, roles: string[]) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const AND: Array<Record<string, unknown>> = [];
    if (query.status) AND.push({ status: query.status });
    if (query.departmentId) AND.push({ departmentId: query.departmentId });
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      AND.push({
        OR: [{ name: contains }, { email: contains }, { employeeNo: contains }],
      });
    }

    if (!satisfiesRole(roles, 'SUPER_ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital') {
        return {
          data: [],
          pagination: { page, pageSize, totalItems: 0, totalPages: 0 },
        };
      }
      AND.push({ department: { hospitalId: scope.hospitalId } });
    }

    if (!satisfiesRole(roles, 'ADMIN')) {
      const me = await this.prisma.employee.findUnique({
        where: { userId },
        select: { id: true, departmentId: true },
      });
      if (!me) {
        return {
          data: [],
          pagination: { page, pageSize, totalItems: 0, totalPages: 0 },
        };
      }
      const scopeOr: Array<Record<string, unknown>> = [{ supervisorId: me.id }];
      if (me.departmentId) scopeOr.push({ departmentId: me.departmentId });
      AND.push({ OR: scopeOr });
    }
    const where = AND.length > 0 ? { AND } : {};
    const [total, rows] = await Promise.all([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          department: { select: { id: true, name: true } },
          supervisor: { select: { id: true, name: true, employeeNo: true } },
        },
      }),
    ]);
    return {
      data: rows,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string, userId: string, roles: string[]) {
    const employee = await this.loadOne(id);

    if (!satisfiesRole(roles, 'SUPER_ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (
        scope.kind !== 'hospital' ||
        employee.department?.hospitalId !== scope.hospitalId
      ) {
        throw new NotFoundException('Employee not found');
      }
    }
    if (!satisfiesRole(roles, 'ADMIN')) {
      await this.assertSupervisorScope(userId, employee);
    }
    return employee;
  }

  private async loadOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, hospitalId: true } },
        supervisor: { select: { id: true, name: true, employeeNo: true } },
        user: { select: { id: true, email: true, isActive: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    const roles = employee.userId ? await rolesOf(this.prisma, employee.userId) : [];
    return { ...employee, roles };
  }

  async findMyEmployee(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee)
      throw new NotFoundException('No employee profile for this account');
    return this.loadOne(employee.id);
  }

  async updateMyProfile(
    userId: string,
    dto: UpdateMyProfileDto,
    meta: { ip?: string } = {},
  ) {
    const existing = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!existing)
      throw new NotFoundException('No employee profile for this account');

    const name = dto.name?.trim();
    if (dto.name !== undefined && (!name || name.length < 2)) {
      throw new BadRequestException('Nama minimal 2 karakter');
    }
    const email = dto.email?.trim().toLowerCase();
    if (email && email !== existing.email) {
      await this.assertUnique(existing.id, email, undefined);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.employee.update({
          where: { id: existing.id },
          data: {
            ...(name ? { name } : {}),
            ...(email ? { email } : {}),
            ...(dto.phone !== undefined
              ? { phone: dto.phone.trim() || null }
              : {}),
          },
        });
        if (email && email !== existing.email && existing.userId) {
          await tx.user.update({
            where: { id: existing.userId },
            data: { email },
          });
        }
      });
    } catch (e) {
      throw mapUniqueError(e);
    }

    await this.audit.log({
      actorId: userId,
      action: 'PROFILE_UPDATED',
      targetType: 'employee',
      targetId: existing.id,
      ipAddress: meta.ip,
      metadata: {
        fields: Object.keys(dto).filter(
          (key) => (dto as Record<string, unknown>)[key] !== undefined,
        ),
      },
    });
    return this.loadOne(existing.id);
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
    actorId: string,
    meta: { ip?: string } = {},
  ) {
    const existing = await this.prisma.employee.findUnique({
      where: { id },
      include: { department: { select: { hospitalId: true } } },
    });
    if (!existing) throw new NotFoundException('Employee not found');

    await assertSameFacility(this.prisma, 
      actorId,
      existing.department?.hospitalId,
      'Employee not found',
    );
    await this.assertRankBelow(actorId, existing.userId);

    const actorRoles = await rolesOf(this.prisma, actorId);
    const supervisorOnly = !satisfiesRole(actorRoles, 'ADMIN');
    if (supervisorOnly) {
      await this.assertSupervisorScope(actorId, existing);
      const forbidden = (
        ['email', 'departmentId', 'supervisorId'] as const
      ).filter((key) => dto[key] !== undefined);
      if (forbidden.length > 0) {
        throw new ForbiddenException(
          `Hanya admin yang dapat mengubah: ${forbidden.join(', ')}`,
        );
      }
    }

    if (dto.email && dto.email !== existing.email) {
      await this.assertUnique(id, dto.email, undefined);
    }
    if (dto.departmentId)
      await this.assertDepartmentInFacility(dto.departmentId, actorId);
    if (dto.supervisorId) {
      if (dto.supervisorId === id)
        throw new ConflictException('Employee cannot supervise themselves');
      await this.assertSupervisorInFacility(dto.supervisorId, actorId);
    }

    const data: UpdateEmployeeDto = supervisorOnly
      ? {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.position !== undefined ? { position: dto.position } : {}),
        }
      : dto;

    try {
      const employee = await this.prisma.employee.update({
        where: { id },
        data: { ...data },
      });
      if (data.email && existing.userId) {
        await this.prisma.user.update({
          where: { id: existing.userId },
          data: { email: data.email },
        });
      }
      await this.audit.log({
        actorId,
        action: 'EMPLOYEE_UPDATED',
        targetType: 'employee',
        targetId: id,
        ipAddress: meta.ip,
        metadata: {
          updated: Object.keys(data),
          scope: supervisorOnly ? 'supervisor' : 'admin',
        },
      });
      return this.loadOne(employee.id);
    } catch (e) {
      throw mapUniqueError(e);
    }
  }

  async deactivate(id: string, actorId: string, meta: { ip?: string } = {}) {
    const existing = await this.prisma.employee.findUnique({
      where: { id },
      include: { department: { select: { hospitalId: true } } },
    });
    if (!existing) throw new NotFoundException('Employee not found');
    await assertSameFacility(this.prisma, 
      actorId,
      existing.department?.hospitalId,
      'Employee not found',
    );
    await this.assertRankBelow(actorId, existing.userId);

    const employee = await this.prisma.employee.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    if (existing.userId) {
      await this.prisma.user.update({
        where: { id: existing.userId },
        data: { isActive: false },
      });

      await this.prisma.session.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.log({
      actorId,
      action: 'EMPLOYEE_DEACTIVATED',
      targetType: 'employee',
      targetId: id,
      ipAddress: meta.ip,
      metadata: { employeeNo: existing.employeeNo },
    });
    return this.loadOne(employee.id);
  }

  private async assertUnique(
    ignoreId: string | null,
    email?: string,
    employeeNo?: string,
  ) {
    if (email) {
      const hit = await this.prisma.user.findUnique({ where: { email } });
      if (hit && (!ignoreId || (await this.ownerOf(hit.id)) !== ignoreId)) {
        throw new ConflictException('Email already in use');
      }
    }
    if (employeeNo) {
      const hit = await this.prisma.employee.findUnique({
        where: { employeeNo },
      });
      if (hit && hit.id !== ignoreId)
        throw new ConflictException('Employee number already in use');
    }
  }

  private async ownerOf(userId: string): Promise<string | null> {
    const emp = await this.prisma.employee.findUnique({ where: { userId } });
    return emp?.id ?? null;
  }

  private async assertSupervisorScope(
    actorId: string,
    target: { supervisorId: string | null; departmentId: string | null },
    message = 'Employee not found',
  ) {
    const me = await this.prisma.employee.findUnique({
      where: { userId: actorId },
      select: { id: true, departmentId: true },
    });
    if (!me) throw new NotFoundException(message);
    const directReport = target.supervisorId === me.id;
    const sameUnit =
      me.departmentId != null && target.departmentId === me.departmentId;
    if (!directReport && !sameUnit) throw new NotFoundException(message);
  }

  private async assertDepartmentInFacility(id: string, actorId: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      select: { hospitalId: true },
    });
    if (!dept) throw new NotFoundException('Department not found');
    await assertSameFacility(
      this.prisma,
      actorId,
      dept.hospitalId,
      'Department not found',
    );
  }

  private async assertSupervisorInFacility(id: string, actorId: string) {
    const sup = await this.prisma.employee.findUnique({
      where: { id },
      include: { department: { select: { hospitalId: true } } },
    });
    if (!sup) throw new NotFoundException('Supervisor not found');
    await assertSameFacility(
      this.prisma,
      actorId,
      sup.department?.hospitalId,
      'Supervisor not found',
    );
  }

  private async assertRankBelow(
    actorId: string,
    targetUserId: string | null | undefined,
  ) {
    const actorRoles = await rolesOf(this.prisma, actorId);
    if (actorRoles.includes('SUPER_ADMIN')) return;
    const targetRoles = targetUserId
      ? await rolesOf(this.prisma, targetUserId)
      : [];
    if (highestRoleRank(targetRoles) >= highestRoleRank(actorRoles)) {
      throw new ForbiddenException(
        'Cannot administer an account at or above your own rank',
      );
    }
  }
}
