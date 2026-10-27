import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token!: string;

  /**
   * Identifies which registered device the token belongs to when the account
   * has more than one active device. Optional for accounts with a single one.
   */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  installationId?: string;
}
