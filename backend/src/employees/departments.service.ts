import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { satisfiesRole } from '../auth/rbac.js';
import { resolveHospitalScope } from '../auth/tenant-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateDepartmentDto, UpdateDepartmentDto } from './dto.js';
import { assertSameFacility, mapUniqueError } from './support.js';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listDepartments(
    hospitalId: string | undefined,
    userId: string,
    roles: string[],
  ) {
    if (!satisfiesRole(roles, 'ADMIN')) {
      const me = await this.prisma.employee.findUnique({
        where: { userId },
        select: { departmentId: true },
      });
      if (!me?.departmentId) return [];
      return this.prisma.department.findMany({
        where: { id: me.departmentId },
        include: { hospital: { select: { id: true, code: true, name: true } } },
      });
    }
    if (!satisfiesRole(roles, 'SUPER_ADMIN')) {
      const scope = await resolveHospitalScope(this.prisma, userId, roles);
      if (scope.kind !== 'hospital') return [];
      hospitalId = scope.hospitalId;
    }
    return this.prisma.department.findMany({
      where: hospitalId ? { hospitalId } : {},
      orderBy: { name: 'asc' },
      include: { hospital: { select: { id: true, code: true, name: true } } },
    });
  }

  async listPublicDepartments() {
    const rows = await this.prisma.department.findMany({
      take: 500,
      orderBy: [{ hospital: { name: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        hospitalId: true,
        hospital: { select: { name: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      hospitalId: row.hospitalId,
      hospitalName: row.hospital.name,
    }));
  }

  async listHospitals(userId: string, roles: string[]) {
    if (satisfiesRole(roles, 'SUPER_ADMIN')) {
      return this.prisma.hospital.findMany({
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true },
      });
    }
    const scope = await resolveHospitalScope(this.prisma, userId, roles);
    if (scope.kind !== 'hospital') return [];
    return this.prisma.hospital.findMany({
      where: { id: scope.hospitalId },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    });
  }

  async createDepartment(
    dto: CreateDepartmentDto,
    actorId: string,
    meta: { ip?: string } = {},
  ) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: dto.hospitalId },
    });
    if (!hospital) throw new NotFoundException('Hospital not found');
    await assertSameFacility(
      this.prisma,
      actorId,
      dto.hospitalId,
      'Hospital not found',
    );

    const clash = await this.prisma.department.findUnique({
      where: {
        hospitalId_name: { hospitalId: dto.hospitalId, name: dto.name },
      },
    });
    if (clash)
      throw new ConflictException(
        'Department name already exists for this hospital',
      );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const dept = await tx.department.create({
          data: { hospitalId: dto.hospitalId, name: dto.name },
          include: {
            hospital: { select: { id: true, code: true, name: true } },
          },
        });
        await this.audit.log(
          {
            actorId,
            action: 'DEPARTMENT_CREATED',
            targetType: 'department',
            targetId: dept.id,
            ipAddress: meta.ip,
            metadata: { name: dto.name, hospitalId: dto.hospitalId },
          },
          tx,
        );
        return dept;
      });
    } catch (e) {
      throw mapUniqueError(e);
    }
  }

  async updateDepartment(
    id: string,
    dto: UpdateDepartmentDto,
    actorId: string,
    meta: { ip?: string } = {},
  ) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');
    await assertSameFacility(
      this.prisma,
      actorId,
      existing.hospitalId,
      'Department not found',
    );

    if (dto.name && dto.name !== existing.name) {
      const clash = await this.prisma.department.findUnique({
        where: {
          hospitalId_name: { hospitalId: existing.hospitalId, name: dto.name },
        },
      });
      if (clash)
        throw new ConflictException(
          'Department name already exists for this hospital',
        );
    }

    try {
      const dept = await this.prisma.department.update({
        where: { id },
        data: { name: dto.name },
        include: { hospital: { select: { id: true, code: true, name: true } } },
      });
      await this.audit.log({
        actorId,
        action: 'DEPARTMENT_UPDATED',
        targetType: 'department',
        targetId: id,
        ipAddress: meta.ip,
        metadata: { updated: Object.keys(dto) },
      });
      return dept;
    } catch (e) {
      throw mapUniqueError(e);
    }
  }

  async deleteDepartment(
    id: string,
    actorId: string,
    meta: { ip?: string } = {},
  ) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');
    await assertSameFacility(
      this.prisma,
      actorId,
      existing.hospitalId,
      'Department not found',
    );

    const staff = await this.prisma.employee.count({
      where: { departmentId: id },
    });
    if (staff > 0) {
      throw new ConflictException(
        `Department still has ${staff} employee assigned; move them first`,
      );
    }

    await this.prisma.department.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'DEPARTMENT_DELETED',
      targetType: 'department',
      targetId: id,
      ipAddress: meta.ip,
      metadata: { name: existing.name },
    });
    return { removed: true };
  }
}
