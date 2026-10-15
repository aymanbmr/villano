import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { Socket } from 'node:net';
import { Setting } from '../settings/setting.entity.js';
import { Order } from '../orders/order.entity.js';
import { EscPos } from './escpos.js';
import { LOGO_BITMAP, LOGO_HEIGHT, LOGO_WIDTH } from './logo.js';
import { PrintJob } from './print-job.entity.js';
import { arpTable, discoverPrinters, findByMac, reachable, type FoundPrinter } from './discovery.js';

export type TicketKind = 'kitchen' | 'bill' | 'receipt';
export type PrinterId = 'counter' | 'kitchen';

export interface PrinterConfig {
  enabled: boolean;
  host: string;
  port: number;
  /** 48 characters on 80 mm paper, 32 on 58 mm. */
  width: number;
  /**
   * The printer's network serial number, burnt in at the factory. The host above
   * is only where it answered last time; this is how it is found again after the
   * router, the box or the Wi-Fi changed underneath it.
   */
  mac: string;
}

export interface PrintingConfig {
  counter: PrinterConfig;
  kitchen: PrinterConfig;
  /** Send the kitchen ticket by itself as soon as an order is sent. */
  autoKitchen: boolean;
  header: {
    name: string;
    subtitle: string;
    address: string;
    phone: string;
    footer: string;
    /** Imprime en bas du ticket, pour que le client se connecte sans demander. */
    wifiName: string;
    wifiPassword: string;
  };
  /**
   * The server cannot reach the café's printers directly (hosted away from
   * the local network): tickets are queued instead, and a small program
   * running at the café (the "relais") fetches and sends them.
   */
  relayEnabled: boolean;
  /**
   * Laisse le navigateur de la caisse imprimer quand le serveur ne le peut
   * pas. A n'activer que si la caisse est lancee par le raccourci Villano,
   * qui passe --kiosk-printing a Chrome : sans cela une fenetre d'impression
   * modale s'ouvrirait a chaque vente et figerait la caisse.
   */
  browserFallback: boolean;
  /** Bearer token the relay presents; regenerated whenever the owner asks. */
  relayToken: string;
}

const SETTINGS_KEY = 'printing';

const DEFAULTS: PrintingConfig = {
  counter: { enabled: false, host: '', port: 9100, width: 48, mac: '' },
  kitchen: { enabled: false, host: '', port: 9100, width: 48, mac: '' },
  autoKitchen: true,
  header: {
    name: 'Villano',
    subtitle: 'Café & Restaurant',
    address: 'Adresse du restaurant',
    phone: 'Tél : 05 00 00 00 00',
    footer: 'Merci de votre visite, à bientôt !',
    wifiName: '',
    wifiPassword: '',
  },
  relayEnabled: false,
  browserFallback: false,
  relayToken: '',
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
    @InjectRepository(PrintJob) private readonly jobs: Repository<PrintJob>,
  ) {}

  /**
   * Relais suspendus a l'arrivee d'un ticket. Les interroger toutes les trois
   * secondes faisait attendre le papier d'autant ; ils gardent desormais leur
   * requete ouverte et sont reveilles des qu'un ticket entre dans la file.
   */
  private jobWaiters: (() => void)[] = [];

  private wakeRelays() {
    const waiting = this.jobWaiters;
    this.jobWaiters = [];
    for (const wake of waiting) wake();
  }

  private waitForJob(seconds: number) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.jobWaiters = this.jobWaiters.filter((w) => w !== wake);
        resolve();
      }, seconds * 1000);
      const wake = () => {
        clearTimeout(timer);
        resolve();
      };
      this.jobWaiters.push(wake);
    });
  }

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

  private static usable(printer: PrinterConfig) {
    return printer.enabled && !!printer.host;
  }

  /**
   * Which printer a ticket goes to: kitchen tickets to the kitchen, the rest to
   * the counter. Small places run a single printer, so a kitchen ticket falls
   * back to the counter rather than not printing at all.
   */
  printerFor(kind: TicketKind, config: PrintingConfig): PrinterId {
    if (kind !== 'kitchen') return 'counter';
    return PrintingService.usable(config.kitchen) ? 'kitchen' : 'counter';
  }

  async print(kind: TicketKind, order: Order): Promise<{ printed: boolean; printer: PrinterId; reason?: string }> {
    const config = await this.getConfig();
    const id = this.printerFor(kind, config);
    if (!PrintingService.usable(config[id])) {
      return { printed: false, printer: id, reason: 'Imprimante non configurée' };
    }

    if (config.relayEnabled) {
      const printer = config[id];
      const payload = this.render(kind, order, config, printer);
      await this.jobs.save(
        this.jobs.create({
          printerId: id,
          host: printer.host,
          port: printer.port,
          payload: payload.toString('base64'),
        }),
      );
      this.wakeRelays();
      return { printed: true, printer: id };
    }

    const printer = await this.locate(id, config);
    const payload = this.render(kind, order, config, printer);
    await this.send(printer, payload);
    return { printed: true, printer: id };
  }

  // -------------------------------------------------------------------------
  // Relais local : le serveur ne peut pas atteindre les imprimantes du café
  // quand il est hébergé ailleurs. Le relais interroge ces deux routes à sa
  // place, protégées par un jeton plutôt que par une session utilisateur.
  // -------------------------------------------------------------------------

  private async assertRelayToken(token: string | undefined) {
    const config = await this.getConfig();
    if (!config.relayToken || token !== config.relayToken) {
      throw new UnauthorizedException('Jeton de relais invalide');
    }
  }

  async regenerateRelayToken() {
    const token = randomBytes(24).toString('hex');
    await this.setConfig({ relayToken: token });
    // Enveloppé dans un objet : renvoyé nu, le jeton n'est pas du JSON valide
    // et le client échouait à le lire.
    return { relayToken: token };
  }

  /**
   * Un ticket qu'on n'a pas su livrer en dix minutes ne vaut plus rien : le
   * client est parti. Le garder bloquerait la file derriere lui — chaque
   * tentative coutant son delai de connexion — et il finirait par sortir en
   * pleine heure de pointe, sans rapport avec ce qui se passe au comptoir.
   */
  private async dropStaleJobs() {
    const cutoff = new Date(Date.now() - 10 * 60_000);
    await this.jobs
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoff', { cutoff })
      .execute();
  }

  async relayJobs(token: string | undefined, limit = 10, waitSeconds = 0) {
    await this.assertRelayToken(token);
    await this.dropStaleJobs();
    const take = Math.min(limit, 50);
    let pending = await this.jobs.find({ order: { id: 'ASC' }, take });
    // Rien a imprimer : plutot que de renvoyer une liste vide et laisser le
    // relais revenir dans trois secondes, on garde la ligne ouverte.
    if (pending.length === 0 && waitSeconds > 0) {
      await this.waitForJob(Math.min(waitSeconds, 30));
      pending = await this.jobs.find({ order: { id: 'ASC' }, take });
    }
    return pending.map((j) => ({
      id: j.id,
      printerId: j.printerId,
      host: j.host,
      port: j.port,
      payload: j.payload,
    }));
  }

  async acknowledgeJob(token: string | undefined, id: number) {
    await this.assertRelayToken(token);
    await this.jobs.delete({ id });
    return { acknowledged: true };
  }

  /**
   * The printer as it can be reached right now. If the saved address answers we
   * use it; otherwise the network is swept for the printer's MAC and the new
   * address is saved, so a caisse moved to another box keeps printing without
   * anyone opening the settings.
   */
  private async locate(id: PrinterId, config: PrintingConfig): Promise<PrinterConfig> {
    const printer = config[id];
    if (await reachable(printer.host, printer.port)) return printer;
    if (!printer.mac) return printer; // nothing to search by: fail on the saved address

    const host = await findByMac(printer.mac, printer.port);
    if (!host || host === printer.host) return printer;

    this.logger.log(`Imprimante ${id} retrouvée en ${host} (était ${printer.host || 'non renseignée'})`);
    await this.setConfig({ [id]: { ...printer, host } } as Partial<PrintingConfig>);
    return { ...printer, host };
  }

  /** Every device answering on the printing port, on the networks of this PC. */
  async discover(): Promise<FoundPrinter[]> {
    return discoverPrinters();
  }

  /** Fire-and-forget: a printer that is off must never block an order. */
  printInBackground(kind: TicketKind, order: Order) {
    void this.print(kind, order).catch((e) => {
      this.logger.warn(`Impression ${kind} impossible : ${e instanceof Error ? e.message : e}`);
    });
  }

  async testPage(id: PrinterId) {
    const config = await this.getConfig();
    if (!config[id].host) throw new BadRequestException("Renseignez l'adresse de l'imprimante");

    if (config.relayEnabled) {
      const printer = config[id];
      const doc = this.testDoc(id, config, printer);
      await this.jobs.save(
        this.jobs.create({
          printerId: id,
          host: printer.host,
          port: printer.port,
          payload: doc.build().toString('base64'),
        }),
      );
      // Le serveur ne peut pas joindre le réseau du café : pas de détection
      // d'adresse ni de numéro réseau ici, seul le relais le peut.
      return { printed: true, printer: id, host: printer.host, mac: printer.mac };
    }

    const printer = await this.locate(id, config);
    const doc = this.testDoc(id, config, printer);
    await this.send(printer, doc.build());
    // The test is the moment the printer is confirmed to be the right one, so
    // that is when its MAC is recorded: from then on it can be found again.
    const mac = await this.macOf(printer.host);
    if (mac && mac !== printer.mac) {
      await this.setConfig({ [id]: { ...printer, mac } } as Partial<PrintingConfig>);
    }
    return { printed: true, printer: id, host: printer.host, mac: mac || printer.mac };
  }

  private testDoc(id: PrinterId, config: PrintingConfig, printer: PrinterConfig) {
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
    return doc;
  }

  private async macOf(host: string) {
    return (await arpTable()).get(host) ?? '';
  }

  // -------------------------------------------------------------------------
  // Tickets
  // -------------------------------------------------------------------------

  private render(kind: TicketKind, order: Order, config: PrintingConfig, printer: PrinterConfig) {
    const doc = new EscPos(printer.width);
    const paid = kind === 'receipt' && order.status === 'paid';
    const where = order.orderType === 'takeaway' ? 'À emporter' : 'Sur place';

    doc.align('center');
    // Le logo n'a sa place que sur le ticket du client : en cuisine il ne
    // ferait que consommer du papier et retarder le bon.
    if (kind !== 'kitchen') {
      doc.image(LOGO_BITMAP, LOGO_WIDTH, LOGO_HEIGHT).feed(1);
    }
    doc.bold(true).size(2).line(config.header.name).size(1);
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
      doc.rule().align('center');
      if (config.header.wifiName || config.header.wifiPassword) {
        doc.bold(true).line('WIFI').bold(false);
        if (config.header.wifiName) doc.line(config.header.wifiName);
        if (config.header.wifiPassword) doc.line(`Mot de passe : ${config.header.wifiPassword}`);
        doc.line('');
      }
      doc.line(config.header.footer);
    }

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
