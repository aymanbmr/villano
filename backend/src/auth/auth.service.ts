import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee, employeeName } from '../employees/employee.entity.js';
import { AuthUser } from './auth.decorators.js';
import { LoginDto } from './dto/login.dto.js';

const DEFAULT_ADMIN_PASSWORD = 'admin1234';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly adminPassword: string;

  constructor(
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.adminPassword = config.get<string>('ADMIN_PASSWORD') ?? DEFAULT_ADMIN_PASSWORD;
    if (this.adminPassword === DEFAULT_ADMIN_PASSWORD) {
      this.logger.warn(
        `ADMIN_PASSWORD non défini : mot de passe admin par défaut "${DEFAULT_ADMIN_PASSWORD}" (à changer dans backend/.env)`,
      );
    }
  }

  async login(dto: LoginDto) {
    let user: AuthUser | null = null;

    if (dto.password !== undefined) {
      if (dto.password === this.adminPassword) {
        user = { id: 0, name: 'Administrateur', role: 'admin' };
      }
    } else if (dto.pin) {
      const employee = await this.employees.findOneBy({ pin: dto.pin, isActive: true });
      if (employee) {
        user = {
          id: employee.id,
          name: employeeName(employee),
          role: employee.role,
        };
      }
    }

    if (!user) {
      // Same message for both paths so the form can't be used to probe PINs
      throw new UnauthorizedException(
        dto.password !== undefined ? 'Mot de passe incorrect' : 'Code PIN incorrect',
      );
    }
    return { token: await this.jwt.signAsync(user), user };
  }
}
