// Mise en page des tickets thermiques, cote caisse.
//
// Transposition de la methode render() de backend/src/printing/printing.service.ts.
// Elle vit desormais ici parce que la caisse imprime en local, sans passer par
// le serveur : c'est elle qui doit produire les octets. Le serveur garde la
// sienne pour sa page d'essai ; les deux doivent rester d'accord.
import type { Order, PrinterConfig, PrintingConfig, WaiterTotals, WorkDay } from '../api';
import type { TicketKind } from '../components/PrintTicket';
import { EscPos } from './escpos';
import { LOGO_BITMAP, LOGO_HEIGHT, LOGO_WIDTH } from './logo';

const money = (n: number) => `${n.toFixed(2)} DH`;

const dateTime = (iso: string | Date) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function renderTicket(
  kind: TicketKind,
  order: Order,
  config: PrintingConfig,
  printer: PrinterConfig,
): Uint8Array {
  // Le bon de bar n'est pas un vrai ticket : juste la commande et l'heure,
  // imprime a la suite du ticket principal sur la meme imprimante comptoir.
  if (kind === 'barman') return renderBarman(order, printer);

  const doc = new EscPos(printer.width);
  const paid = kind === 'receipt' && order.status === 'paid';
  const where = order.orderType === 'takeaway' ? 'À emporter' : 'Sur place';
  // Le bon de cuisine est un ticket de preparation : grosses lettres, sans prix.
  const prep = kind === 'kitchen';

  doc.align('center');
  // Le logo n'a sa place que sur le ticket du client : en cuisine il ne
  // ferait que consommer du papier et retarder le bon.
  if (!prep) {
    doc.image(LOGO_BITMAP, LOGO_WIDTH, LOGO_HEIGHT).feed(1);
  }
  doc.bold(true).size(2).line(config.header.name).size(1);
  if (!prep) {
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

  if (prep) doc.size(2).bold(true).line(where).size(1).bold(false);
  else doc.bold(true).line(where).bold(false);
  if (order.waiterName) doc.line(`Serveur : ${order.waiterName}`);
  doc.rule();

  if (prep) {
    doc.size(2).bold(true);
    for (const line of order.items) doc.line(`${line.quantity} x ${line.productName}`);
    doc.size(1).bold(false);
  } else {
    for (const line of order.items) {
      doc.item(`${line.quantity} × ${line.productName}`, money(line.lineTotal));
    }
  }

  if (order.note) doc.rule().bold(true).line(`Note : ${order.note}`).bold(false);

  if (!prep) {
    doc.rule();
    if (order.discount > 0) {
      doc.row('Sous-total', money(order.subtotal)).row('Remise', `- ${money(order.discount)}`);
    }
    doc.bold(true).bigRow('TOTAL', money(order.total)).bold(false);
    if (paid) {
      doc.row(
        order.paymentMethod === 'cash' ? 'Espèces' : 'Carte bancaire',
        money(order.amountPaid ?? order.total),
      );
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

/**
 * Petit ticket pour le barman : juste la commande et l'heure, rien d'autre.
 * Il sort de l'imprimante comptoir, a la suite du ticket principal.
 */
function renderBarman(order: Order, printer: PrinterConfig): Uint8Array {
  const doc = new EscPos(printer.width);
  doc.row(`N° ${order.ticketNumber}`, dateTime(order.createdAt));
  doc.rule();
  doc.size(2).bold(true);
  for (const line of order.items) doc.line(`${line.quantity} x ${line.productName}`);
  doc.size(1).bold(false);
  return doc.cut().build();
}

/**
 * Page d'essai, jumelle de testDoc() cote serveur. Elle sert a verifier qu'une
 * adresse repond et que les accents sortent correctement, avant de confier de
 * vraies ventes a l'imprimante.
 */
export function renderTestPage(
  id: 'counter' | 'kitchen',
  config: PrintingConfig,
  printer: PrinterConfig,
): Uint8Array {
  const doc = new EscPos(printer.width);
  return doc
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
    .cut()
    .build();
}

/**
 * Ticket de clôture de journée : ce que le caissier compte à la caisse en
 * espèces doit correspondre au total « Espèces » imprimé ici. Transpose le
 * récapitulatif déjà affiché dans la popup de clôture, pour en garder une
 * trace papier.
 */
export function renderClosingTicket(
  workDay: Pick<WorkDay, 'openedAt' | 'closedAt' | 'openedBy' | 'closedBy'>,
  summary: { orders: number; revenue: number; cash: number; card: number; byWaiter: WaiterTotals[] },
  config: PrintingConfig,
  printer: PrinterConfig,
): Uint8Array {
  const doc = new EscPos(printer.width);
  doc.align('center').bold(true).size(2).line(config.header.name).size(1).bold(false);
  doc.line(config.header.subtitle);
  doc.rule().bold(true).line('CLÔTURE DE JOURNÉE').bold(false).align('left');
  doc.rule();
  doc.row('Ouverte par', workDay.openedBy);
  doc.row('Depuis', dateTime(workDay.openedAt));
  doc.row('Clôturée par', workDay.closedBy ?? '—');
  doc.row('Le', dateTime(workDay.closedAt ?? new Date()));
  doc.rule();
  doc.row('Commandes encaissées', String(summary.orders));
  doc.row('Espèces', money(summary.cash));
  doc.row('Carte', money(summary.card));
  doc.bold(true).bigRow('TOTAL', money(summary.revenue)).bold(false);

  if (summary.byWaiter.length > 0) {
    doc.rule().bold(true).line('PAR SERVEUR').bold(false);
    for (const row of summary.byWaiter) {
      doc.line(row.waiterName);
      doc.row(`${row.orders} cmd · esp. ${money(row.cash)}`, `cb ${money(row.card)}`);
      doc.row('Total', money(row.revenue));
    }
  }

  doc.rule().align('center').line(config.header.footer);
  return doc.cut().build();
}

/**
 * Quelle imprimante pour quel ticket. La cuisine retombe sur le comptoir quand
 * elle n'est pas renseignee : mieux vaut un bon qui sort au mauvais endroit
 * qu'un bon qui ne sort pas.
 */
export function printerFor(kind: TicketKind, config: PrintingConfig): PrinterConfig | null {
  const utilisable = (p: PrinterConfig) => p.enabled && !!p.host;
  if (kind === 'kitchen') {
    if (utilisable(config.kitchen)) return config.kitchen;
    return utilisable(config.counter) ? config.counter : null;
  }
  // Le bon de bar n'a pas d'imprimante a lui : il part du comptoir, comme le
  // ticket principal qu'il suit.
  return utilisable(config.counter) ? config.counter : null;
}
