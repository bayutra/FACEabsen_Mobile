import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';

export async function loadEmployeeForUser(
  prisma: PrismaService,
  userId: string,
) {
  const employee = await prisma.employee.findUnique({ where: { userId } });
  if (!employee)
    throw new NotFoundException('No employee profile for this account');
  return employee;
}

export function emptyPage(page: number, pageSize: number) {
  return {
    data: [],
    pagination: { page, pageSize, totalItems: 0, totalPages: 0 },
  };
}
