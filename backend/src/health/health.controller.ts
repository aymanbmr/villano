import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';

// Tiny public endpoint the caisse pings to know whether the server is
// reachable (navigator.onLine only knows about the network card).
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { ok: true, time: new Date().toISOString() };
  }
}
