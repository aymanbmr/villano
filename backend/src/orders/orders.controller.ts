import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import {
  AddItemsDto,
  CreateOrderDto,
  PayOrderDto,
  UpdateItemDto,
  UpdateOrderDto,
} from './dto/create-order.dto.js';
import { OrderStatus } from './order.entity.js';

const STATUSES: OrderStatus[] = ['pending', 'paid', 'cancelled'];

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // GET /orders?status=pending
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (status && !STATUSES.includes(status as OrderStatus)) {
      throw new BadRequestException(`status must be one of ${STATUSES.join(', ')}`);
    }
    return this.orders.findAll(status as OrderStatus | undefined, limit ? Number(limit) : undefined, from, to);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.orders.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }

  @Post(':id/items')
  addItems(@Param('id', ParseIntPipe) id: number, @Body() dto: AddItemsDto) {
    return this.orders.addItems(id, dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrderDto) {
    return this.orders.update(id, dto);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateItemDto,
  ) {
    return this.orders.updateItem(id, itemId, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.orders.remove(id);
  }

  @Patch(':id/pay')
  pay(@Param('id', ParseIntPipe) id: number, @Body() dto: PayOrderDto) {
    return this.orders.pay(id, dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.orders.cancel(id);
  }
}
