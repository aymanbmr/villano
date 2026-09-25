import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order, OrderItem } from './order.entity.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { ProductsModule } from '../products/products.module.js';
import { PrintingModule } from '../printing/printing.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem]), ProductsModule, forwardRef(() => PrintingModule)],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
