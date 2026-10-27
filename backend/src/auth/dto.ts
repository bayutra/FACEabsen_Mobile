import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string;

  /**
   * Asal login. `MOBILE` menolak peran dashboard (ADMIN/SUPER_ADMIN/
   * SUPERVISOR) karena area tersebut hanya tersedia di dashboard web.
   */
  @IsOptional()
  @IsIn(['MOBILE', 'WEB'])
  client?: 'MOBILE' | 'WEB';
}

export class RefreshDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  refreshToken!: string;
}

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9-]+$/)
  @MaxLength(32)
  employeeNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  departmentId?: string;
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

export class VerifyEmailDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @Matches(/^\\d{6}$/)
  code!: string;
}

export class ResendVerificationDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
