import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './employee.entity.js';
import { EmployeesController } from './employees.controller.js';
import { StaffController } from './staff.controller.js';
import { EmployeesService } from './employees.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Employee])],
  controllers: [EmployeesController, StaffController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
