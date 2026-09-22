import { Controller, Get } from '@nestjs/common';
import { EmployeesService } from './employees.service.js';

// Separate from EmployeesController (which is @AdminOnly and returns
// salary/phone/pin): any logged-in caisse user needs the active staff list
// to pick who is responsible for an order.
@Controller('staff')
export class StaffController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  roster() {
    return this.employees.findRoster();
  }
}
