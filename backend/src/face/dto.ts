import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const FACE_DIM = 192;
export const MIN_QUALITY = 0.6;

export class RegisterFaceDto {
  /** L2-normalized MobileFaceNet embedding, exactly 192 finite floats. */
  @IsArray()
  @ArrayMinSize(FACE_DIM)
  @ArrayMaxSize(FACE_DIM)
  @IsNumber({}, { each: true })
  template!: number[];

  /** Client-assessed quality 0..1 (blur/brightness/size composite). */
  @IsNumber()
  @Min(0)
  @Max(1)
  qualityScore!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  algorithm?: string;
}
