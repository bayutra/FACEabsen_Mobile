import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;

  /** Optional bound device (strict device checks arrive in STEP 7). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  refreshToken!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  newPassword!: string;
}
