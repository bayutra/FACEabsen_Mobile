import { IsBoolean, IsISO8601, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GeoCheckDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  /** 1-sigma accuracy reported by the OS, meters. */
  @IsNumber()
  @Min(0)
  @Max(10000)
  accuracyM!: number;

  @IsISO8601()
  timestamp!: string;

  /** Android mock-location flag, passed through for server judgment. */
  @IsBoolean()
  isMocked!: boolean;

  /**
   * Override hospital; default = employee's department hospital.
   * Kept for wire compatibility (mobile clients still send it) but ignored
   * server-side for non-SUPER_ADMIN callers (M4).
   */
  @IsOptional()
  @IsString()
  hospitalId?: string;
}

/** SUPER_ADMIN-only perimeter edit. Radius dibatasi 10–1000 m. */
export class UpdateFenceDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsInt()
  @Min(10)
  @Max(1000)
  radiusMeters!: number;
}
