import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { EMPLOYEE_ROLES, type EmployeeRole } from '../employee.entity.js';

export class CreateEmployeeDto {
  @IsString()
  @MaxLength(60)
  firstName: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @IsIn(EMPLOYEE_ROLES)
  role: EmployeeRole;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salary?: number | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  hireDate?: string | null;

  @IsOptional()
  @Matches(/^\d{4,6}$/, { message: 'Le code PIN doit contenir 4 à 6 chiffres' })
  pin?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
