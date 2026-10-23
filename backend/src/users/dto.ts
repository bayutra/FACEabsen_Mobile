import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const ROLE_NAMES = ['EMPLOYEE', 'SUPERVISOR', 'ADMIN', 'SUPER_ADMIN'] as const;

export class ListUsersQuery {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(ROLE_NAMES)
  role?: (typeof ROLE_NAMES)[number];

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined
      ? undefined
      : value === 'true'
        ? true
        : value === 'false'
          ? false
          : value,
  )
  @IsBoolean()
  isActive?: boolean;

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

export class CreateUserDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;

  @IsOptional()
  @IsArray()
  @IsIn(ROLE_NAMES, { each: true })
  roles?: string[];
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsArray()
  @IsIn(ROLE_NAMES, { each: true })
  roles?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;
}

export class VerifyEmailOverrideDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
