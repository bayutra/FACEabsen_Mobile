import {
  IsEmail,
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

/**
 * Pendaftaran mandiri (self-service). Akun baru selalu mendapat peran
 * EMPLOYEE — peran administratif hanya bisa diberikan lewat `/users` oleh
 * ADMIN/SUPER_ADMIN, supaya pendaftaran publik tidak menjadi jalur eskalasi.
 */
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

  /** Nomor karyawan opsional; bila kosong dibuat otomatis (EMP-###). */
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
