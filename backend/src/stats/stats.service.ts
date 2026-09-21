import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Order } from '../orders/order.entity.js';
import { Product } from '../products/product.entity.js';

const round2 = (n: number) => Math.round(n * 100) / 100;

// Local calendar day "YYYY-MM-DD" of a date (the server runs where the café is)
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseDay = (s: string, label: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequestException(`${label} : date invalide (AAAA-MM-JJ)`);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export interface StatsRange {
  from: string; // inclusive day
  to: string; // inclusive day
}

export interface Totals {
  revenue: number;
  orders: number;
  items: number;
  averageTicket: number;
  discounts: number;
  cash: number;
  card: number;
  dineIn: number;
  takeaway: number;
  cancelled: number;
}

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async summary(range: StatsRange) {
    const from = parseDay(range.from, 'from');
    const to = parseDay(range.to, 'to');
    if (to < from) throw new BadRequestException('La date de fin précède la date de début');
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;

    // Same length of time immediately before, for the deltas on the KPI tiles
    const prevTo = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - days + 1);

    const [current, previous] = await Promise.all([
      this.loadPaid(from, to),
      this.loadPaid(prevFrom, prevTo),
    ]);
    const cancelled = await this.orders.count({
      where: { status: 'cancelled', createdAt: Between(from, endOfDay(to)) },
    });

    // --- revenue per day (every day of the range, zero-filled)
    const byDay = new Map<string, { revenue: number; orders: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      byDay.set(dayKey(d), { revenue: 0, orders: 0 });
    }
    // --- revenue per hour of day 0..23
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, orders: 0 }));
    // --- per product / per category
    const byProduct = new Map<
      string,
      { productId: number | null; name: string; quantity: number; revenue: number }
    >();
    const byCategory = new Map<string, { name: string; quantity: number; revenue: number }>();
    const productCategory = await this.productCategoryIndex();

    for (const o of current) {
      const paidAt = new Date(o.paidAt ?? o.createdAt);
      const day = byDay.get(dayKey(paidAt));
      if (day) {
        day.revenue = round2(day.revenue + o.total);
        day.orders += 1;
      }
      const h = byHour[paidAt.getHours()];
      h.revenue = round2(h.revenue + o.total);
      h.orders += 1;

      for (const it of o.items) {
        const key = it.productId != null ? `p${it.productId}` : `n${it.productName}`;
        const p = byProduct.get(key) ?? {
          productId: it.productId,
          name: it.productName,
          quantity: 0,
          revenue: 0,
        };
        p.quantity += it.quantity;
        p.revenue = round2(p.revenue + it.lineTotal);
        byProduct.set(key, p);

        const catName =
          (it.productId != null && productCategory.get(it.productId)) || 'Sans catégorie';
        const c = byCategory.get(catName) ?? { name: catName, quantity: 0, revenue: 0 };
        c.quantity += it.quantity;
        c.revenue = round2(c.revenue + it.lineTotal);
        byCategory.set(catName, c);
      }
    }

    const products = [...byProduct.values()];
    return {
      range: { from: range.from, to: range.to, days },
      totals: this.totals(current, cancelled),
      previous: this.totals(previous, 0),
      byDay: [...byDay.entries()].map(([day, v]) => ({ day, ...v })),
      byHour,
      bestSellers: {
        byQuantity: [...products].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
        byRevenue: [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      },
      byCategory: [...byCategory.values()].sort((a, b) => b.revenue - a.revenue),
      // Items that never sold in the period (candidates to review on the menu)
      unsold: await this.unsoldProducts(new Set(products.map((p) => p.productId))),
    };
  }

  private totals(orders: Order[], cancelled: number): Totals {
    const revenue = round2(orders.reduce((s, o) => s + o.total, 0));
    const items = orders.reduce((s, o) => s + o.items.reduce((n, i) => n + i.quantity, 0), 0);
    const sum = (f: (o: Order) => number) => round2(orders.reduce((s, o) => s + f(o), 0));
    return {
      revenue,
      orders: orders.length,
      items,
      averageTicket: orders.length ? round2(revenue / orders.length) : 0,
      discounts: sum((o) => o.discount),
      cash: sum((o) => (o.paymentMethod === 'cash' ? o.total : 0)),
      card: sum((o) => (o.paymentMethod === 'card' ? o.total : 0)),
      dineIn: orders.filter((o) => o.orderType === 'dine_in').length,
      takeaway: orders.filter((o) => o.orderType === 'takeaway').length,
      cancelled,
    };
  }

  private loadPaid(from: Date, to: Date) {
    return this.orders.find({
      where: { status: 'paid', paidAt: Between(from, endOfDay(to)) },
      order: { paidAt: 'ASC' },
    });
  }

  private async productCategoryIndex() {
    const all = await this.products.find();
    return new Map(all.map((p) => [p.id, p.category?.name ?? null]));
  }

  private async unsoldProducts(soldIds: Set<number | null>) {
    const all = await this.products.find({ where: { isAvailable: true } });
    return all
      .filter((p) => !soldIds.has(p.id))
      .map((p) => ({ productId: p.id, name: p.name, price: p.price, stock: p.stock }));
  }
}

function endOfDay(d: Date) {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}
