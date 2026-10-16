import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateShiftDto {
  @IsString()
  hospitalId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(32)
  name!: string;

  @Matches(HHMM)
  startTime!: string;

  @Matches(HHMM)
  endTime!: string;

  /** If omitted, derived (end <= start means overnight). If given, must match. */
  @IsOptional()
  @IsBoolean()
  overnight?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  gracePeriodMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lateThresholdMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  earlyCheckoutThresholdMin?: number;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  name?: string;

  @IsOptional()
  @Matches(HHMM)
  startTime?: string;

  @IsOptional()
  @Matches(HHMM)
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  overnight?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  gracePeriodMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lateThresholdMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  earlyCheckoutThresholdMin?: number;
}

export class ListShiftsQuery {
  @IsOptional()
  @IsString()
  hospitalId?: string;
}

export class CreateScheduleDto {
  @IsString()
  employeeId!: string;

  @IsString()
  shiftId!: string;

  /** Shift START date; a night shift still counts as this one day. */
  @Matches(DATE)
  workDate!: string;
}

export class ListSchedulesQuery {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsOptional()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @Matches(DATE)
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
