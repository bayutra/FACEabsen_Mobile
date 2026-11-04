import { ConflictException, NotFoundException } from '@nestjs/common';
import { satisfiesRole } from '../auth/rbac.js';
import { resolveHospitalScope } from '../auth/tenant-scope.js';
import type { PrismaService } from '../prisma/prisma.service.js';

export async function rolesOf(
  prisma: PrismaService,
  userId: string,
): Promise<string[]> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  });
  return rows.map((r) => r.role.name);
}

export async function assertSameFacility(
  prisma: PrismaService,
  actorId: string,
  targetHospitalId: string | null | undefined,
  message: string,
): Promise<void> {
  const actorRoles = await rolesOf(prisma, actorId);
  if (satisfiesRole(actorRoles, 'SUPER_ADMIN')) return;
  const scope = await resolveHospitalScope(prisma, actorId, actorRoles);
  if (
    scope.kind !== 'hospital' ||
    !targetHospitalId ||
    targetHospitalId !== scope.hospitalId
  ) {
    throw new NotFoundException(message);
  }
}

export function mapUniqueError(e: unknown): unknown {
  if (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: string }).code === 'P2002'
  ) {
    const fields =
      (e as { meta?: { target?: string[] } }).meta?.target?.join(', ') ??
      'field';
    return new ConflictException(`${fields} already in use`);
  }
  return e;
}
