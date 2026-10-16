import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const REPLACEMENT_REASONS = ['BROKEN', 'LOST', 'STOLEN', 'UPGRADE', 'OTHER'] as const;

export class CreateChangeRequestDto {
  /** Already-registered PENDING device on the new phone (register first). */
  @IsString()
  newDeviceId!: string;

  @IsIn([...REPLACEMENT_REASONS])
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonNote?: string;

  /** Identity verification (PRD §11.3). Face verification joins in STEP 9. */
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

export class ReviewChangeRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}

export class ListChangeRequestsQuery {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
}
