import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/order.entity.js';
import { WorkDay } from './work-day.entity.js';
import { WorkDaysController } from './work-days.controller.js';
import { WorkDaysService } from './work-days.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([WorkDay, Order])],
  controllers: [WorkDaysController],
  providers: [WorkDaysService],
  exports: [WorkDaysService],
})
export class WorkDaysModule {}
