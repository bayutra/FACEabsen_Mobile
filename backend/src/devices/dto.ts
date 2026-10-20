import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  /** Client-generated stable install identifier (uuid). */
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

  /** Ed25519 public key (base64). Private key never leaves the device. */
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  devicePublicKey!: string;

  /**
   * Stateless registration challenge (proof-of-possession, H7): a JWT with
   * `purpose:'device-register'` minted by `GET /devices/register-challenge`.
   * The raw nonce string is signed below so the server knows the caller holds
   * the private key matching `devicePublicKey`.
   */
  @IsString()
  @MinLength(8)
  @MaxLength(2048)
  nonce!: string;

  /** Base64 Ed25519 signature over the raw `nonce` string. */
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

/** STEP 18 — admin direct activation of a PENDING device. */
export class ActivateDeviceDto {
  /** Why this device is being trusted without a replacement request. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
