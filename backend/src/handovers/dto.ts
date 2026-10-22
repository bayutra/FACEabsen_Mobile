import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateHandoverDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  patientSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  pendingTasks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  medications?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  incidents?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @IsString()
  toEmployeeId?: string;
}

export class ListHandoversQuery {
  @IsOptional()
  @IsString()
  status?: 'PENDING' | 'ACKNOWLEDGED';

  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class AcknowledgeHandoverDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
