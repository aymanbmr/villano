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
    const day = await this.days.save(this.days.create({ openedBy }));
    // Same shape as /work-day/current: the caller gets a day with its summary
    // (all zeros at this point) instead of a day without one.
    return { ...day, summary: await this.summaryFor(day) };
  }

  async close(id: number, closedBy: string) {
    const day = await this.days.findOneBy({ id });
    if (!day) throw new NotFoundException('Journée introuvable');
    if (day.closedAt) throw new BadRequestException('Cette journée est déjà clôturée');

    // Une commande est encaissée dès sa prise : plus rien ne devrait rester en
    // suspens. Les bases d'avant ce changement en gardent, et clôturer
    // par-dessus laisserait des ventes hors de toute journée — mais seules
    // celles de la journée en cours doivent la retenir. Sans cette condition,
    // une commande oubliée il y a des semaines bloquait la clôture pour
    // toujours, sans qu'on puisse la trouver nulle part.
    // La comparaison se fait en JavaScript, pas en base : SQLite enregistre ces
    // dates à la seconde tandis que le pilote interroge à la milliseconde, et
    // une commande prise dans la même seconde que l'ouverture passait au
    // travers. Les commandes en suspens se comptent sur les doigts d'une main,
    // normalement aucune : les lire toutes ne coûte rien.
    const opened = new Date(day.openedAt).getTime();
    const unsettled = await this.orders.find({ where: { status: 'pending' } });
    const blocking = unsettled.filter((o) => new Date(o.createdAt).getTime() >= opened);
    if (blocking.length > 0) {
      // Les nommer : une commande d'un jour passé n'apparaît nulle part dans la
      // caisse, qui ne montre que celles du jour. Sans son numéro, elle est
      // introuvable et la journée reste bloquée sans qu'on sache pourquoi.
      const numeros = blocking.map((o) => o.ticketNumber).join(', ');
      const pluriel = blocking.length > 1;
      throw new BadRequestException(
        `Impossible de clôturer : ${blocking.length} commande${pluriel ? 's' : ''} encore en cours ` +
          `(${numeros}). Encaissez-${pluriel ? 'les' : 'la'} ou annulez-${pluriel ? 'les' : 'la'} d'abord.`,
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
