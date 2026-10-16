import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export const CORRECTION_TYPES = ['MISSED_CHECK_IN', 'MISSED_CHECK_OUT', 'WRONG_TIME', 'TECHNICAL_ISSUE'] as const;

export class CreateCorrectionDto {
  @IsString()
  attendanceId!: string;

  @IsIn([...CORRECTION_TYPES])
  type!: string;

  @IsOptional()
  @IsISO8601()
  requestedCheckIn?: string;

  @IsOptional()
  @IsISO8601()
  requestedCheckOut?: string;

  @IsString()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  evidenceUrl?: string;
}

export class ReviewCorrectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}

export class ListCorrectionsQuery {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

  @IsOptional()
  @IsString()
  employeeId?: string;
}
