import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { AdminOnly, CaisseOnly } from '../auth/auth.decorators.js';
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

  // Whether kitchen slips go out at all. Operational rather than sensitive, so
  // the caisse may flip it without being admin — the printer addresses, which
  // are, stay behind the full config endpoint.
  @CaisseOnly()
  @Patch('auto-kitchen')
  autoKitchen(@Body('enabled') enabled: boolean) {
    return this.printing.setConfig({ autoKitchen: Boolean(enabled) });
  }

  // Sweeps the networks of this PC for anything answering on the printing port,
  // so the addresses never have to be typed in by hand.
  @AdminOnly()
  @Get('discover')
  discover() {
    return this.printing.discover();
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
