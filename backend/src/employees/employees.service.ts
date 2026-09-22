import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Employee } from './employee.entity.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly repo: Repository<Employee>,
  ) {}

  findAll(includeInactive = false) {
    return this.repo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { isActive: 'DESC', lastName: 'ASC', firstName: 'ASC' },
    });
  }

  // Minimal, non-sensitive fields (no salary/phone/pin/notes): used to let
  // the cashier pick who is responsible for an order, without exposing HR data
  findRoster() {
    return this.repo.find({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
  }

  async findOne(id: number) {
    const employee = await this.repo.findOneBy({ id });
    if (!employee) throw new NotFoundException(`Employé ${id} introuvable`);
    return employee;
  }

  async create(dto: CreateEmployeeDto) {
    await this.assertPinFree(dto.pin);
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    const employee = await this.findOne(id);
    await this.assertPinFree(dto.pin, id);
    Object.assign(employee, dto);
    return this.repo.save(employee);
  }

  // PINs are the login credential, so two employees can't share one
  private async assertPinFree(pin: string | null | undefined, exceptId?: number) {
    if (!pin) return;
    const clash = await this.repo.findOneBy(
      exceptId ? { pin, id: Not(exceptId) } : { pin },
    );
    if (clash) {
      throw new ConflictException(
        `Ce code PIN est déjà utilisé par ${clash.firstName} ${clash.lastName}`,
      );
    }
  }

  async remove(id: number) {
    const employee = await this.findOne(id);
    await this.repo.remove(employee);
    return { deleted: true };
  }
}
