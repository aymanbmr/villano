import { IsOptional, IsString, MaxLength } from 'class-validator';

// Either a PIN (employee) or the master admin password
export class LoginDto {
  @IsOptional()
  @IsString()
  @MaxLength(6)
  pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  password?: string;
}
