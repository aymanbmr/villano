import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Socket } from 'node:net';
import { Setting } from '../settings/setting.entity.js';
import { Order } from '../orders/order.entity.js';
import { EscPos } from './escpos.js';

export type TicketKind = 'kitchen' | 'bill' | 'receipt';
export type PrinterId = 'counter' | 'kitchen';

export interface PrinterConfig {
  enabled: boolean;
  host: string;
  port: number;
  /** 48 characters on 80 mm paper, 32 on 58 mm. */
  width: number;
  /** Opens the cash drawer wired to this printer when a receipt is printed. */
  openDrawer: boolean;
}

export interface PrintingConfig {
  counter: PrinterConfig;
  kitchen: PrinterConfig;
  /** Send the kitchen ticket by itself as soon as an order is sent. */
  autoKitchen: boolean;
  header: { name: string; subtitle: string; address: string; phone: string; footer: string };
}

const SETTINGS_KEY = 'printing';

const DEFAULTS: PrintingConfig = {
  counter: { enabled: false, host: '', port: 9100, width: 48, openDrawer: false },
  kitchen: { enabled: false, host: '', port: 9100, width: 48, openDrawer: false },
  autoKitchen: true,
  header: {
    name: 'Villano',
    subtitle: 'Café & Restaurant',
    address: 'Adresse du restaurant',
    phone: 'Tél : 05 00 00 00 00',
    footer: 'Merci de votre visite, à bientôt !',
  },
};

const money = (n: number) => `${n.toFixed(2)} DH`;

const dateTime = (iso: string | Date) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

@Injectable()
export class PrintingService {
  private readonly logger = new Logger(PrintingService.name);

  constructor(
    @InjectRepository(Setting) private readonly settings: Repository<Setting>,
  ) {}

  async getConfig(): Promise<PrintingConfig> {
    const row = await this.settings.findOneBy({ key: SETTINGS_KEY });
    if (!row) return DEFAULTS;
    try {
      const saved = JSON.parse(row.value) as Partial<PrintingConfig>;
      return {
        ...DEFAULTS,
        ...saved,
        counter: { ...DEFAULTS.counter, ...saved.counter },
        kitchen: { ...DEFAULTS.kitchen, ...saved.kitchen },
        header: { ...DEFAULTS.header, ...saved.header },
      };
    } catch {
      return DEFAULTS;
    }
  }

  async setConfig(patch: Partial<PrintingConfig>): Promise<PrintingConfig> {
    const current = await this.getConfig();
    const next: PrintingConfig = {
      ...current,
      ...patch,
      counter: { ...current.counter, ...patch.counter },
      kitchen: { ...current.kitchen, ...patch.kitchen },
      header: { ...current.header, ...patch.header },
    };
    await this.settings.save({ key: SETTINGS_KEY, value: JSON.stringify(next) });
    return next;
  }

  /** Which printer a ticket goes to: kitchen tickets to the kitchen, the rest to the counter. */
  private printerFor(kind: TicketKind): PrinterId {
    return kind === 'kitchen' ? 'kitchen' : 'counter';
  }

  async print(kind: TicketKind, order: Order): Promise<{ printed: boolean; printer: PrinterId; reason?: string }> {
    const config = await this.getConfig();
    const id = this.printerFor(kind);
    const printer = config[id];
    if (!printer.enabled || !printer.host) {
      return { printed: false, printer: id, reason: 'Imprimante non configurée' };
    }
    const payload = this.render(kind, order, config, printer);
    await this.send(printer, payload);
    return { printed: true, printer: id };
  }

  /** Fire-and-forget: a printer that is off must never block an order. */
  printInBackground(kind: TicketKind, order: Order) {
    void this.print(kind, order).catch((e) => {
      this.logger.warn(`Impression ${kind} impossible : ${e instanceof Error ? e.message : e}`);
    });
  }

  async testPage(id: PrinterId) {
    const config = await this.getConfig();
    const printer = config[id];
    if (!printer.host) throw new BadRequestException("Renseignez l'adresse de l'imprimante");
    const doc = new EscPos(printer.width);
    doc
      .align('center')
      .size(2)
      .bold(true)
      .line(config.header.name)
      .size(1)
      .bold(false)
      .line(id === 'kitchen' ? 'Imprimante CUISINE' : 'Imprimante COMPTOIR')
      .line(dateTime(new Date()))
      .rule()
      .align('left')
      .line('Test d’impression réussi.')
      .line('Accents : é è à ç ô û')
      .item('1 × Café crème', money(15))
      .rule()
      .align('center')
      .line(`${printer.host}:${printer.port}`)
      .cut();
    await this.send(printer, doc.build());
    return { printed: true, printer: id };
  }

  // -------------------------------------------------------------------------
  // Tickets
  // -------------------------------------------------------------------------

  private render(kind: TicketKind, order: Order, config: PrintingConfig, printer: PrinterConfig) {
    const doc = new EscPos(printer.width);
    const paid = kind === 'receipt' && order.status === 'paid';
    const where =
      order.orderType === 'takeaway'
        ? 'À emporter'
        : order.tableNumber
          ? `Table ${order.tableNumber}`
          : 'Sur place';

    doc.align('center').bold(true).size(2).line(config.header.name).size(1);
    if (kind !== 'kitchen') {
      doc
        .bold(false)
        .line(config.header.subtitle)
        .line(config.header.address)
        .line(config.header.phone);
    }
    doc.bold(false).rule().bold(true);
    doc.line(kind === 'kitchen' ? 'BON DE CUISINE' : kind === 'bill' ? 'ADDITION' : 'TICKET DE CAISSE');
    doc.bold(false).align('left');
    doc.row(`N° ${order.ticketNumber}`, dateTime(paid && order.paidAt ? order.paidAt : order.createdAt));

    // The kitchen needs the table in big characters, it is read across the pass
    if (kind === 'kitchen') doc.size(2).bold(true).line(where).size(1).bold(false);
    else doc.bold(true).line(where).bold(false);
    if (order.waiterName) doc.line(`Serveur : ${order.waiterName}`);
    doc.rule();

    if (kind === 'kitchen') {
      doc.size(2).bold(true);
      for (const line of order.items) doc.line(`${line.quantity} x ${line.productName}`);
      doc.size(1).bold(false);
    } else {
      for (const line of order.items) {
        doc.item(`${line.quantity} × ${line.productName}`, money(line.lineTotal));
      }
    }

    if (order.note) doc.rule().bold(true).line(`Note : ${order.note}`).bold(false);

    if (kind !== 'kitchen') {
      doc.rule();
      if (order.discount > 0) {
        doc.row('Sous-total', money(order.subtotal)).row('Remise', `- ${money(order.discount)}`);
      }
      doc.bold(true).bigRow('TOTAL', money(order.total)).bold(false);
      if (paid) {
        doc.row(order.paymentMethod === 'cash' ? 'Espèces' : 'Carte bancaire', money(order.amountPaid ?? order.total));
        if (order.paymentMethod === 'cash') doc.row('Rendu', money(order.changeGiven));
      } else {
        doc.align('center').bold(true).line('NON PAYÉ').bold(false).align('left');
      }
      doc.rule().align('center').line(config.header.footer);
    }

    if (paid && printer.openDrawer && order.paymentMethod === 'cash') doc.openDrawer();
    return doc.cut().build();
  }

  // -------------------------------------------------------------------------
  // Transport: raw ESC/POS over TCP 9100, the port every network thermal
  // printer listens on.
  // -------------------------------------------------------------------------

  private send(printer: PrinterConfig, payload: Buffer, timeoutMs = 6000) {
    return new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      const fail = (message: string) => {
        socket.destroy();
        reject(new BadRequestException(message));
      };
      socket.setTimeout(timeoutMs);
      socket.once('timeout', () => fail(`L’imprimante ${printer.host}:${printer.port} ne répond pas`));
      socket.once('error', (e: NodeJS.ErrnoException) =>
        fail(
          e.code === 'ECONNREFUSED'
            ? `Connexion refusée par ${printer.host}:${printer.port} (imprimante éteinte ou mauvais port ?)`
            : `Imprimante injoignable : ${e.message}`,
        ),
      );
      socket.connect(printer.port, printer.host, () => {
        socket.end(payload, () => {
          socket.destroy();
          resolve();
        });
      });
    });
  }
}
