import { Controller, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser, CaisseOnly } from '../auth/auth.decorators.js';
import { WorkDaysService } from './work-days.service.js';

@Controller('work-day')
export class WorkDaysController {
  constructor(private readonly workDays: WorkDaysService) {}

  @Get('current')
  current() {
    return this.workDays.currentWithSummary();
  }

  // Only the cashier (or manager/admin) starts and ends service
  @CaisseOnly()
  @Post('open')
  open(@Req() req: Request & { user: AuthUser }) {
    return this.workDays.open(req.user.name);
  }

  @CaisseOnly()
  @Patch(':id/close')
  close(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user: AuthUser }) {
    return this.workDays.close(id, req.user.name);
  }
}
