import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from '../settings/setting.entity.js';
import { Product } from '../products/product.entity.js';
import { OrdersModule } from '../orders/orders.module.js';
import { PrintingController } from './printing.controller.js';
import { PrintingService } from './printing.service.js';
import { PrintJob } from './print-job.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Setting, PrintJob, Product]), forwardRef(() => OrdersModule)],
  controllers: [PrintingController],
  providers: [PrintingService],
  exports: [PrintingService],
})
export class PrintingModule {}
