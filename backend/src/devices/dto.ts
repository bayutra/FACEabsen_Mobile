import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RegisterDeviceDto {
   
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  installationId!: string;

  @IsIn(['ANDROID', 'IOS'])
  platform!: 'ANDROID' | 'IOS';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;

   
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  devicePublicKey!: string;

   
  @IsString()
  @MinLength(8)
  @MaxLength(2048)
  nonce!: string;

   
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  nonceSignature!: string;
}

export class ListDevicesQuery {
  @IsOptional()
  @IsIn(['PENDING', 'ACTIVE', 'REVOKED', 'LOST', 'REPLACED'])
  status?: 'PENDING' | 'ACTIVE' | 'REVOKED' | 'LOST' | 'REPLACED';
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

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

export class RevokeDeviceDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

 
export class ActivateDeviceDto {
   
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
