// Mise en page des tickets thermiques, cote caisse.
//
// Transposition de la methode render() de backend/src/printing/printing.service.ts.
// Elle vit desormais ici parce que la caisse imprime en local, sans passer par
// le serveur : c'est elle qui doit produire les octets. Le serveur garde la
// sienne pour sa page d'essai ; les deux doivent rester d'accord.
import type { Order, PrinterConfig, PrintingConfig } from '../api';
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
  const doc = new EscPos(printer.width);
  const paid = kind === 'receipt' && order.status === 'paid';
  const where = order.orderType === 'takeaway' ? 'À emporter' : 'Sur place';

  doc.align('center');
  // Le logo n'a sa place que sur le ticket du client : en cuisine il ne ferait
  // que consommer du papier et retarder le bon.
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

  // La cuisine lit le bon a distance, d'ou les gros caracteres
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
  return utilisable(config.counter) ? config.counter : null;
}
