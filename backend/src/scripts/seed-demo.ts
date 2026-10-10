import { NestFactory } from '@nestjs/core';
import { Like, Repository } from 'typeorm';
import { AppModule } from '../app.module.js';
import { Order, OrderItem } from '../orders/order.entity.js';
import { Product } from '../products/product.entity.js';
import { Employee } from '../employees/employee.entity.js';

// Generates realistic sales history so the dashboard has something to show.
//   npm run seed:demo            -> adds ~30 days of orders (tagged "Démo")
//   npm run seed:demo -- --clear -> removes them again
// Stock is NOT touched: these are past sales, not reservations.

const DEMO_NOTE = 'Démo';
const DAYS = 30;
const round2 = (n: number) => Math.round(n * 100) / 100;

// Deterministic pseudo-random so re-runs look the same
let seed = 20260921;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const weighted = <T>(items: { item: T; w: number }[]) => {
  const total = items.reduce((s, i) => s + i.w, 0);
  let r = rand() * total;
  for (const i of items) {
    r -= i.w;
    if (r <= 0) return i.item;
  }
  return items[items.length - 1].item;
};

// Orders per hour: breakfast, lunch, tea time, dinner
const HOUR_WEIGHTS: Record<number, number> = {
  7: 2, 8: 5, 9: 6, 10: 5, 11: 4, 12: 7, 13: 8, 14: 5, 15: 3, 16: 4, 17: 5, 18: 4, 19: 6, 20: 7, 21: 5, 22: 2,
};

async function main() {
  const clear = process.argv.includes('--clear');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const orders: Repository<Order> = app.get('OrderRepository');
  const products: Repository<Product> = app.get('ProductRepository');
  const employees: Repository<Employee> = app.get('EmployeeRepository');

  if (clear) {
    const demo = await orders.find({ where: { note: Like(`${DEMO_NOTE}%`) } });
    await orders.remove(demo);
    console.log(`Supprimé ${demo.length} commande(s) de démonstration.`);
    await app.close();
    return;
  }

  const catalogue = await products.find();
  if (catalogue.length === 0) throw new Error('Aucun produit : lancez d’abord le serveur une fois (seed du menu).');

  // Sans serveur rattaché, la colonne « responsable » des ventes et le détail
  // de fin de journée resteraient vides — soit précisément ce qu'on veut voir.
  const waiters = await employees.find({ where: { role: 'serveur', isActive: true } });
  if (waiters.length === 0) {
    console.log('Aucun serveur actif : les commandes seront créées sans responsable.');
  }

  // Drinks sell far more often than dishes
  const menu = catalogue.map((p) => ({
    item: p,
    w: p.price <= 12 ? 6 : p.price <= 20 ? 4 : p.price <= 30 ? 2.5 : 1.5,
  }));

  // Existing ticket numbers per day so we continue the sequence instead of clashing
  const existing = await orders.find({ select: { ticketNumber: true } });
  const seqByDay = new Map<string, number>();
  for (const o of existing) {
    const [day, n] = o.ticketNumber.split('-');
    seqByDay.set(day, Math.max(seqByDay.get(day) ?? 0, Number(n) || 0));
  }

  const today = new Date();
  let created = 0;
  let revenue = 0;

  for (let back = DAYS; back >= 0; back--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    const weekend = day.getDay() === 5 || day.getDay() === 6 || day.getDay() === 0;
    const base = weekend ? 34 : 22;
    const count = Math.round(base * (0.8 + rand() * 0.5));
    const dayKey = `${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}${String(day.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < count; i++) {
      const hour = weighted(Object.entries(HOUR_WEIGHTS).map(([h, w]) => ({ item: Number(h), w })));
      const at = new Date(day);
      at.setHours(hour, Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
      if (at > today) continue; // today: only up to now

      const items: OrderItem[] = [];
      const lines = weighted([{ item: 1, w: 4 }, { item: 2, w: 5 }, { item: 3, w: 3 }, { item: 4, w: 1 }]);
      const used = new Set<number>();
      for (let l = 0; l < lines; l++) {
        const p = weighted(menu);
        if (used.has(p.id)) continue;
        used.add(p.id);
        const it = new OrderItem();
        it.productId = p.id;
        it.productName = p.name;
        it.unitPrice = p.price;
        it.quantity = rand() < 0.25 ? 2 : 1;
        it.lineTotal = round2(it.unitPrice * it.quantity);
        items.push(it);
      }
      if (items.length === 0) continue;

      const subtotal = round2(items.reduce((s, it) => s + it.lineTotal, 0));
      const discount = rand() < 0.08 ? Math.min(subtotal, pick([5, 10])) : 0;
      const total = round2(subtotal - discount);
      const cancelled = rand() < 0.03;
      const takeaway = rand() < 0.2;
      const cash = rand() < 0.6;
      const amountPaid = cash ? Math.ceil(total / 10) * 10 + (rand() < 0.3 ? 10 : 0) : total;

      const seq = (seqByDay.get(dayKey) ?? 0) + 1;
      seqByDay.set(dayKey, seq);

      const order = orders.create({
        ticketNumber: `${dayKey}-${String(seq).padStart(3, '0')}`,
        orderType: takeaway ? 'takeaway' : 'dine_in',
        tableNumber: takeaway ? null : String(1 + Math.floor(rand() * 12)),
        ...(waiters.length ? (({ id, firstName, lastName }) => ({
          waiterId: id,
          waiterName: `${firstName} ${lastName}`,
        }))(pick(waiters)) : {}),
        status: cancelled ? 'cancelled' : 'paid',
        subtotal,
        discount,
        total,
        paymentMethod: cancelled ? null : cash ? 'cash' : 'card',
        amountPaid: cancelled ? null : amountPaid,
        changeGiven: cancelled ? 0 : round2(amountPaid - total),
        paidAt: cancelled ? null : new Date(at.getTime() + (20 + rand() * 40) * 60_000),
        note: DEMO_NOTE,
        items,
        createdAt: at,
      });
      await orders.save(order);
      created++;
      if (!cancelled) revenue += total;
    }
  }

  console.log(`Créé ${created} commandes de démonstration sur ${DAYS + 1} jours (CA ≈ ${round2(revenue)} DH).`);
  console.log('Pour les retirer : npm run seed:demo -- --clear');
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
