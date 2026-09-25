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
import { PrintingService } from '../printing/printing.service.js';
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
  constructor(
    private readonly orders: OrdersService,
    private readonly printing: PrintingService,
  ) {}

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
  async create(@Body() dto: CreateOrderDto) {
    const order = await this.orders.create(dto);
    // The kitchen ticket prints by itself at the pass, so a waiter taking an
    // order from a phone never has to walk to a printer. A printer that is
    // off or unplugged must not fail the order, hence the background call.
    const config = await this.printing.getConfig();
    if (config.autoKitchen) this.printing.printInBackground('kitchen', order);
    return order;
  }

  @Post(':id/items')
  async addItems(@Param('id', ParseIntPipe) id: number, @Body() dto: AddItemsDto) {
    const order = await this.orders.addItems(id, dto);
    // Only the lines just added are of any use to the kitchen: the saved
    // order carries the running totals, the ticket carries the new quantities.
    const config = await this.printing.getConfig();
    if (config.autoKitchen) {
      const quantities = new Map<number, number>();
      for (const line of dto.items) {
        quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
      }
      const added = order.items
        .filter((item) => item.productId !== null && quantities.has(item.productId))
        .map((item) => ({ ...item, quantity: quantities.get(item.productId!)! }));
      this.printing.printInBackground('kitchen', { ...order, items: added });
    }
    return order;
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
