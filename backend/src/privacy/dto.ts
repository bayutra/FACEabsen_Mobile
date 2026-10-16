import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export const CONSENT_PURPOSES = ['BIOMETRIC_ATTENDANCE'] as const;

export class ConsentDto {
  @IsIn([...CONSENT_PURPOSES])
  purpose!: string;

  @IsBoolean()
  granted!: boolean;

  @IsOptional()
  @IsString()
  version?: string;
}

export class NoticeDto {
  @IsOptional()
  @IsString()
  lang?: string;
}
