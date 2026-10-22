import { satisfiesRole } from './rbac.js';

export type HospitalScope =
  | { kind: 'global' }
  | { kind: 'hospital'; hospitalId: string }
  | { kind: 'none' };

interface ScopePrisma {
  employee: {
    findUnique(args: unknown): Promise<any>;
  };
}

 
export async function resolveHospitalScope(
  prisma: ScopePrisma,
  userId: string,
  roles: string[],
): Promise<HospitalScope> {
  if (satisfiesRole(roles, 'SUPER_ADMIN')) return { kind: 'global' };
  
  
  const me = await prisma.employee.findUnique({
    where: { userId },
    include: { department: { select: { hospitalId: true } } },
  });
  const hospitalId = me?.department?.hospitalId;
  if (!hospitalId) return { kind: 'none' };
  return { kind: 'hospital', hospitalId };
}
