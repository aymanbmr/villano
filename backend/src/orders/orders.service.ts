import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { Product } from '../products/product.entity.js';
import { WorkDay } from '../work-days/work-day.entity.js';
import { Order, OrderItem, OrderStatus } from './order.entity.js';
import {
  AddItemsDto,
  CreateOrderDto,
  OrderItemDto,
  PayOrderDto,
  UpdateItemDto,
  UpdateOrderDto,
} from './dto/create-order.dto.js';

const round2 = (n: number) => Math.round(n * 100) / 100;

const localDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

// Error messages are shown as-is to the cashier, hence French
const TABLE_REQUIRED = 'Le numéro de table est obligatoire pour une commande sur place';
const DAY_CLOSED = 'Ouvrez la journée avant de prendre des commandes';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  // from/to are local calendar days (YYYY-MM-DD), inclusive
  findAll(status?: OrderStatus, limit = 50, from?: string, to?: string) {
    const where: FindOptionsWhere<Order> = {};
    if (status) where.status = status;
    if (from || to) {
      const start = from ? localDay(from) : new Date(2000, 0, 1);
      const end = to ? localDay(to) : new Date();
      end.setHours(23, 59, 59, 999);
      where.createdAt = Between(start, end);
    }
    return this.orders.find({
      where,
      order: { createdAt: status === 'pending' ? 'ASC' : 'DESC' },
      take: Math.min(limit, 500),
    });
  }

  async findOne(id: number) {
    const order = await this.orders.findOneBy({ id });
    if (!order) throw new NotFoundException(`Commande ${id} introuvable`);
    return order;
  }

  // Creates the order and reserves stock right away (the kitchen starts
  // preparing). Payment normally happens later via pay().
  create(dto: CreateOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const openDay = await manager.getRepository(WorkDay).findOne({ where: { closedAt: IsNull() } });
      if (!openDay) throw new BadRequestException(DAY_CLOSED);

      const orderType = dto.orderType ?? 'dine_in';
      const tableNumber = dto.tableNumber?.trim() || null;
      if (orderType === 'dine_in' && !tableNumber) {
        throw new BadRequestException(TABLE_REQUIRED);
      }
      const items = await this.reserveItems(manager, dto.items, []);
      const order = manager.getRepository(Order).create({
        ticketNumber: await this.nextTicketNumber(manager.getRepository(Order)),
        orderType,
        tableNumber,
        note: dto.note ?? null,
        status: 'pending',
        items,
      });
      this.recomputeTotals(order);
      if (dto.payment) this.applyPayment(order, dto.payment);
      return manager.getRepository(Order).save(order);
    });
  }

  // The customer orders more while the order is open
  addItems(id: number, dto: AddItemsDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.loadForUpdate(manager, id);
      if (order.status !== 'pending') {
        throw new BadRequestException('Seules les commandes en cours peuvent être modifiées');
      }
      order.items = await this.reserveItems(manager, dto.items, order.items);
      this.recomputeTotals(order);
      return manager.getRepository(Order).save(order);
    });
  }

  pay(id: number, dto: PayOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.loadForUpdate(manager, id);
      if (order.status === 'paid') throw new BadRequestException('Commande déjà payée');
      if (order.status === 'cancelled') throw new BadRequestException('Commande annulée');
      this.applyPayment(order, dto);
      return manager.getRepository(Order).save(order);
    });
  }

  // Cancelling puts the stock back so the menu counts stay accurate
  cancel(id: number) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.loadForUpdate(manager, id);
      if (order.status === 'cancelled') return order;

      await this.restoreStock(manager, order);
      order.status = 'cancelled';
      return manager.getRepository(Order).save(order);
    });
  }


  // Change table / type / note of an open order
  update(id: number, dto: UpdateOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.loadForUpdate(manager, id);
      this.assertOpen(order);
      if (dto.orderType !== undefined) order.orderType = dto.orderType;
      if (dto.tableNumber !== undefined) order.tableNumber = dto.tableNumber?.trim() || null;
      if (dto.note !== undefined) order.note = dto.note || null;
      if (order.orderType === 'takeaway') order.tableNumber = null;
      if (order.orderType === 'dine_in' && !order.tableNumber) {
        throw new BadRequestException(TABLE_REQUIRED);
      }
      return manager.getRepository(Order).save(order);
    });
  }

  // Set a line's quantity (0 removes it); stock follows the difference
  updateItem(id: number, itemId: number, dto: UpdateItemDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.loadForUpdate(manager, id);
      this.assertOpen(order);
      const line = order.items.find((i) => i.id === itemId);
      if (!line) throw new NotFoundException('Ligne introuvable sur cette commande');

      const delta = dto.quantity - line.quantity;
      if (delta === 0) return order;
      if (dto.quantity === 0 && order.items.length === 1) {
        throw new BadRequestException(
          'Une commande doit garder au moins un article : supprimez la commande à la place',
        );
      }

      const products = manager.getRepository(Product);
      if (line.productId != null) {
        const product = await products.findOneBy({ id: line.productId });
        if (product) {
          if (delta > 0 && product.stock < delta) {
            throw new BadRequestException(
              `Stock insuffisant pour « ${product.name} » (reste ${product.stock})`,
            );
          }
          product.stock -= delta;
          await products.save(product);
        }
      }

      if (dto.quantity === 0) {
        // Filter by reference: remove() clears line.id, so an id comparison would keep it
        order.items = order.items.filter((i) => i !== line);
        await manager.getRepository(OrderItem).remove(line);
      } else {
        line.quantity = dto.quantity;
        line.lineTotal = round2(line.unitPrice * line.quantity);
      }
      this.recomputeTotals(order);
      return manager.getRepository(Order).save(order);
    });
  }

  // Hard-delete a mistaken open order (stock put back). Paid orders are
  // kept for the history: use cancel() for those.
  remove(id: number) {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.loadForUpdate(manager, id);
      if (order.status === 'paid') {
        throw new BadRequestException('Une commande payée ne peut pas être supprimée : annulez-la');
      }
      if (order.status === 'pending') await this.restoreStock(manager, order);
      await manager.getRepository(Order).remove(order);
      return { deleted: true };
    });
  }

  private assertOpen(order: Order) {
    if (order.status !== 'pending') {
      throw new BadRequestException('Seules les commandes en cours peuvent être modifiées');
    }
  }

  private async restoreStock(manager: EntityManager, order: Order) {
    const products = manager.getRepository(Product);
    for (const item of order.items) {
      if (item.productId == null) continue;
      await products.increment({ id: item.productId }, 'stock', item.quantity);
    }
  }

  private async loadForUpdate(manager: EntityManager, id: number) {
    const order = await manager.getRepository(Order).findOneBy({ id });
    if (!order) throw new NotFoundException(`Commande ${id} introuvable`);
    return order;
  }

  // Checks stock, decrements it, and returns the merged list of lines
  // (a product already on the order gets its quantity increased).
  private async reserveItems(
    manager: EntityManager,
    requested: OrderItemDto[],
    existing: OrderItem[],
  ) {
    const products = manager.getRepository(Product);
    const items = [...existing];

    const wanted = new Map<number, number>();
    for (const line of requested) {
      wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.quantity);
    }

    for (const [productId, quantity] of wanted) {
      const product = await products.findOneBy({ id: productId });
      if (!product) throw new NotFoundException(`Produit ${productId} introuvable`);
      if (!product.isAvailable) {
        throw new BadRequestException(`« ${product.name} » n'est pas disponible`);
      }
      if (product.stock < quantity) {
        throw new BadRequestException(
          `Stock insuffisant pour « ${product.name} » (demandé ${quantity}, reste ${product.stock})`,
        );
      }
      product.stock -= quantity;
      await products.save(product);

      const line = items.find((i) => i.productId === product.id);
      if (line) {
        line.quantity += quantity;
        line.lineTotal = round2(line.unitPrice * line.quantity);
      } else {
        const item = new OrderItem();
        item.productId = product.id;
        item.productName = product.name;
        item.unitPrice = product.price;
        item.quantity = quantity;
        item.lineTotal = round2(product.price * quantity);
        items.push(item);
      }
    }
    return items;
  }

  private recomputeTotals(order: Order) {
    order.subtotal = round2(order.items.reduce((sum, i) => sum + i.lineTotal, 0));
    order.discount = round2(order.discount ?? 0);
    order.total = round2(order.subtotal - order.discount);
  }

  private applyPayment(order: Order, dto: PayOrderDto) {
    const discount = round2(dto.discount ?? 0);
    if (discount > order.subtotal) {
      throw new BadRequestException('La remise ne peut pas dépasser le sous-total');
    }
    order.discount = discount;
    order.total = round2(order.subtotal - discount);

    const amountPaid =
      dto.paymentMethod === 'card' ? order.total : round2(dto.amountPaid ?? order.total);
    if (amountPaid < order.total) {
      throw new BadRequestException(
        `Montant reçu (${amountPaid}) inférieur au total (${order.total})`,
      );
    }
    order.paymentMethod = dto.paymentMethod;
    order.amountPaid = amountPaid;
    order.changeGiven = round2(amountPaid - order.total);
    order.status = 'paid';
    order.paidAt = new Date();
  }

  // Ticket numbers restart every day: 20260920-001, 20260920-002, ...
  private async nextTicketNumber(repo: Repository<Order>) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const prefix = `${y}${m}${d}-`;

    const last = await repo
      .createQueryBuilder('o')
      .where('o.ticketNumber LIKE :p', { p: `${prefix}%` })
      .orderBy('o.id', 'DESC')
      .getOne();
    const seq = last ? Number(last.ticketNumber.slice(prefix.length)) + 1 : 1;
    return prefix + String(seq).padStart(3, '0');
  }
}
