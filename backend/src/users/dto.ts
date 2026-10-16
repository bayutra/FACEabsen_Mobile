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
  @Transform(({ value }) => value === undefined ? undefined : value === 'true' ? true : value === 'false' ? false : value)
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

/**
 * A login account WITHOUT an employee record — e.g. a pure IT/admin desk that
 * never clocks in. Staff who need attendance are provisioned through
 * `POST /employees`, which creates the account and the employee row together.
 */
export class CreateUserDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;

  /** Grant-checked with canAssignRole; EMPLOYEE is always added implicitly. */
  @IsOptional()
  @IsArray()
  @IsIn(ROLE_NAMES, { each: true })
  roles?: string[];
}

export class UpdateUserDto {
  /**
   * No `@MinLength` here: class-validator only applies it to strings, so it
   * rejects every array outright. Non-emptiness is enforced in UsersService with
   * a clearer message ("At least one role is required").
   */
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