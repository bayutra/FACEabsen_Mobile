import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListAuditQuery {
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

  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  actorEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetType?: string;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsIn(['SUCCESS', 'FAILED', 'DENIED'])
  result?: 'SUCCESS' | 'FAILED' | 'DENIED';

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  /** Preset filter for security-relevant events (PRD §41 monitoring feed). */
  @IsOptional()
  @Transform(({ value }) => value === undefined ? undefined : value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  security?: boolean;
}
