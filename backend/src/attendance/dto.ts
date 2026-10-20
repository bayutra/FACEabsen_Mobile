import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class LivenessAttestationDto {
  @IsBoolean()
  passed!: boolean;

  /** Active challenge list. Omitted in passive (Face-ID style) runs. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  challenges?: string[];

  @IsISO8601()
  completedAt!: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  score!: number;

  /** `active` = blink/head-turn commands, `passive` = no user commands. */
  @IsOptional()
  @IsIn(['active', 'passive'])
  mode?: 'active' | 'passive';

  /** Anti-spoofing confidence from the on-device analyser (0..1). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  padScore?: number;
}

class AttendanceSignalsDto {
  @IsString()
  deviceId!: string;

  /** Live 192-d embedding (never stored). */
  @IsArray()
  @ArrayMinSize(192)
  @ArrayMaxSize(192)
  @IsNumber({}, { each: true })
  faceEmbedding!: number[];

  @ValidateNested()
  @Type(() => LivenessAttestationDto)
  liveness!: LivenessAttestationDto;

  /** Anti-replay: uuid v4, single use (idempotency_keys). */
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  requestId!: string;

  @IsISO8601()
  requestTimestamp!: string;

  /** Ed25519 base64 over "<requestId>.<requestTimestamp>" by device key. */
  @IsString()
  @MinLength(10)
  @MaxLength(256)
  signature!: string;

  @IsBoolean()
  deviceCompromised!: boolean;

  /**
   * Play Integrity / App Attest token (opaque JWT, short-lived).
   * Optional untuk kompatibilitas klien lama; wajib bila INTEGRITY_STRICT=true.
   */
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(8192)
  integrityToken?: string;
}

export class CheckInDto extends AttendanceSignalsDto {}
export class CheckOutDto extends AttendanceSignalsDto {}

export class MyHistoryQuery {
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
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @IsIn(['ON_TIME', 'LATE', 'VERY_LATE'])
  checkInStatus?: 'ON_TIME' | 'LATE' | 'VERY_LATE';
}

export class AdminHistoryQuery extends MyHistoryQuery {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  riskCategory?: 'LOW' | 'MEDIUM' | 'HIGH';

  @IsOptional()
  @Transform(({ value }) => value === undefined ? undefined : value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  needsReview?: boolean;
}
