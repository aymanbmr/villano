import { Controller, Get, Query } from '@nestjs/common';
import { AdminOnly } from '../auth/auth.decorators.js';
import { StatsService } from './stats.service.js';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

@AdminOnly()
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  // GET /stats?from=2026-09-01&to=2026-09-21  (defaults to today)
  @Get()
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    const t = today();
    return this.stats.summary({ from: from ?? t, to: to ?? t });
  }
}
