import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEmployeeDto {
  @Matches(/^[A-Za-z0-9-]+$/)
  @MaxLength(32)
  employeeNo!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  supervisorId?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;

  @IsOptional()
  @IsString({ each: true })
  roles?: string[];
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  supervisorId?: string;
}

export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}

export class CreateDepartmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  hospitalId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  name!: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  name?: string;
}

export class ListEmployeesQuery {
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
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
