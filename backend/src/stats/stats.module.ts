import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/order.entity.js';
import { Product } from '../products/product.entity.js';
import { StatsController } from './stats.controller.js';
import { StatsService } from './stats.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Product])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
