import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const FACE_DIM = 192;
export const MIN_QUALITY = 0.4;

export class RegisterFaceDto {
   
  @IsArray()
  @ArrayMinSize(FACE_DIM)
  @ArrayMaxSize(FACE_DIM)
  @IsNumber({}, { each: true })
  template!: number[];

   
  @IsNumber()
  @Min(0)
  @Max(1)
  qualityScore!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  algorithm?: string;
}
