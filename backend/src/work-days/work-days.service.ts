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

    // Closing with unsettled orders would leave sales outside any day: they
    // must be cashed in or cancelled first.
    const pending = await this.orders.count({ where: { status: 'pending' } });
    if (pending > 0) {
      throw new BadRequestException(
        `Impossible de clôturer : ${pending} commande${pending > 1 ? 's' : ''} encore en cours. Encaissez-les ou annulez-les d'abord.`,
      );
    }

    const summary = await this.summaryFor(day);
    day.closedAt = new Date();
    day.closedBy = closedBy;
    await this.days.save(day);
    return { ...day, summary };
  }

  // What each waiter brought in during the day. Orders taken without a
  // waiter (takeaway at the counter) are grouped at the end.
  private byWaiter(paid: Order[]) {
    const rows = new Map<
      string,
      { waiterId: number | null; waiterName: string; orders: number; items: number; revenue: number; cash: number; card: number }
    >();
    for (const order of paid) {
      const key = order.waiterId != null ? String(order.waiterId) : 'sans';
      const row = rows.get(key) ?? {
        waiterId: order.waiterId ?? null,
        waiterName: order.waiterName ?? 'Sans serveur',
        orders: 0,
        items: 0,
        revenue: 0,
        cash: 0,
        card: 0,
      };
      row.orders += 1;
      row.items += order.items.reduce((n, i) => n + i.quantity, 0);
      row.revenue = round2(row.revenue + order.total);
      if (order.paymentMethod === 'cash') row.cash = round2(row.cash + order.total);
      else if (order.paymentMethod === 'card') row.card = round2(row.card + order.total);
      rows.set(key, row);
    }
    return [...rows.values()].sort((a, b) => {
      if ((a.waiterId === null) !== (b.waiterId === null)) return a.waiterId === null ? 1 : -1;
      return b.revenue - a.revenue;
    });
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
      byWaiter: this.byWaiter(paid),
    };
  }
}
