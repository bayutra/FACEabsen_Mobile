import { IsString, MaxLength, MinLength } from 'class-validator';

// Lenient shapes on purpose: any wrong code/token surfaces as 401 from the
// service (never a 400 that distinguishes "malformed" from "incorrect").

export class EnableTotpDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;
}

export class DisableTotpDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

export class VerifyTotpDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  totpToken!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;
}

export class RecoverTotpDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  totpToken!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  recoveryCode!: string;
}
