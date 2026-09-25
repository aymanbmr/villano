import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { AdminOnly } from '../auth/auth.decorators.js';
import { OrdersService } from '../orders/orders.service.js';
import { PrintingService, type PrinterId, type PrintingConfig, type TicketKind } from './printing.service.js';

@Controller('printing')
export class PrintingController {
  constructor(
    private readonly printing: PrintingService,
    private readonly orders: OrdersService,
  ) {}

  // The caisse needs to know whether server-side printing is on
  @Get('config')
  config() {
    return this.printing.getConfig();
  }

  @AdminOnly()
  @Put('config')
  save(@Body() patch: Partial<PrintingConfig>) {
    return this.printing.setConfig(patch);
  }

  @AdminOnly()
  @Post('test/:printer')
  test(@Param('printer') printer: PrinterId) {
    return this.printing.testPage(printer === 'kitchen' ? 'kitchen' : 'counter');
  }

  // Any logged-in user: a waiter sending an order prints in the kitchen
  @Post(':kind/:orderId')
  async print(@Param('kind') kind: TicketKind, @Param('orderId', ParseIntPipe) orderId: number) {
    const order = await this.orders.findOne(orderId);
    return this.printing.print(kind, order);
  }
}
