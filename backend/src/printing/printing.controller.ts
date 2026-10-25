import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { AdminOnly, CAISSE_ROLES, Public, Roles } from '../auth/auth.decorators.js';
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
  // are, stay behind the full config endpoint. Also open to "serveur" : when
  // there is no cashier on shift, a waiter running the till alone still needs
  // to control whether their own orders print in the kitchen.
  @Roles(...CAISSE_ROLES, 'serveur')
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

  // A new token invalidates whatever the relay currently holds — used once,
  // at setup, or if the token ever leaks.
  @AdminOnly()
  @Post('relay/token')
  regenerateRelayToken() {
    return this.printing.regenerateRelayToken();
  }

  // -------------------------------------------------------------------------
  // The relais is a standalone program at the café, not a logged-in user: it
  // authenticates with the token above instead of a session.
  // -------------------------------------------------------------------------

  @Public()
  @Get('relay/jobs')
  relayJobs(
    @Headers('x-relay-token') token?: string,
    @Query('token') queryToken?: string,
    // Secondes pendant lesquelles le serveur garde la ligne ouverte si la file
    // est vide : le ticket part alors des qu'il est pret, sans attendre le
    // prochain passage du relais.
    @Query('wait') wait?: string,
  ) {
    return this.printing.relayJobs(token ?? queryToken, 10, Number(wait) || 0);
  }

  @Public()
  @Delete('relay/jobs/:id')
  acknowledgeJob(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-relay-token') token?: string,
    @Query('token') queryToken?: string,
  ) {
    return this.printing.acknowledgeJob(token ?? queryToken, id);
  }

  // Any logged-in user: a waiter sending an order prints in the kitchen.
  // Declared last: ":kind/:orderId" would otherwise swallow the routes above.
  @Post(':kind/:orderId')
  async print(@Param('kind') kind: TicketKind, @Param('orderId', ParseIntPipe) orderId: number) {
    const order = await this.orders.findOne(orderId);
    return this.printing.print(kind, order);
  }
}
