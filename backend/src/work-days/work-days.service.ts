import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Repository } from 'typeorm';
import { Order } from '../orders/order.entity.js';
import { WorkDay } from './work-day.entity.js';

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class WorkDaysService {
  constructor(
    @InjectRepository(WorkDay) private readonly days: Repository<WorkDay>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  // The open day, if any (there is at most one at a time)
  current() {
    return this.days.findOne({ where: { closedAt: IsNull() }, order: { id: 'DESC' } });
  }

  async currentWithSummary() {
    const day = await this.current();
    if (!day) return null;
    return { ...day, summary: await this.summaryFor(day) };
  }

  async open(openedBy: string) {
    const existing = await this.current();
    if (existing) throw new BadRequestException('Une journée est déjà ouverte');
    const day = this.days.create({ openedBy });
    return this.days.save(day);
  }

  async close(id: number, closedBy: string) {
    const day = await this.days.findOneBy({ id });
    if (!day) throw new NotFoundException('Journée introuvable');
    if (day.closedAt) throw new BadRequestException('Cette journée est déjà clôturée');

    const summary = await this.summaryFor(day);
    day.closedAt = new Date();
    day.closedBy = closedBy;
    await this.days.save(day);
    return { ...day, summary };
  }

  // Sales settled between the opening of the day and now (or its closing)
  private async summaryFor(day: WorkDay) {
    const end = day.closedAt ?? new Date();
    const paid = await this.orders.find({
      where: { status: 'paid', paidAt: Between(day.openedAt, end) },
    });
    return {
      orders: paid.length,
      revenue: round2(paid.reduce((s, o) => s + o.total, 0)),
      cash: round2(paid.filter((o) => o.paymentMethod === 'cash').reduce((s, o) => s + o.total, 0)),
      card: round2(paid.filter((o) => o.paymentMethod === 'card').reduce((s, o) => s + o.total, 0)),
    };
  }
}
