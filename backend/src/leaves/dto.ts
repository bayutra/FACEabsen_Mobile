import { IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const LEAVE_TYPES = ['CUTI', 'SAKIT', 'IZIN', 'DINAS', 'LAINNYA'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateLeaveDto {
  @IsIn([...LEAVE_TYPES])
  type!: string;

  @Matches(DATE)
  startDate!: string;

  @Matches(DATE)
  endDate!: string;

  @IsString()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  evidenceUrl?: string;
}

export class ReviewLeaveDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}

export class ListLeavesQuery {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
