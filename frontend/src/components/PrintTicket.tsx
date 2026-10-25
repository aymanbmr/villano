import { createPortal } from 'react-dom';
import { formatPrice, orderLabel, type Order } from '../api';
import { RESTAURANT } from '../config';
import { LOGO_MARK_DATA_URL } from '../assets/logoMark';

// kitchen: what to prepare (big quantities, no prices)
// barman:  small slip for the bar — drink lines, ticket number and time only,
//          printed on the counter printer right after the main ticket
// bill:    the pre-bill handed to the customer before paying
// receipt: proof of payment after the order is settled
export type TicketKind = 'kitchen' | 'bill' | 'receipt' | 'barman';

export interface PrintJob {
  kind: TicketKind;
  order: Order;
  /** Wi-Fi du café, repris des réglages du serveur pour que le ticket du
   *  navigateur dise la même chose que celui de l'imprimante réseau. */
  wifi?: { name?: string; password?: string };
}

const TITLES: Record<TicketKind, string> = {
  kitchen: 'BON DE CUISINE',
  barman: 'BON DE BAR',
  bill: 'ADDITION',
  receipt: 'TICKET DE CAISSE',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// Rendered off-screen and only visible under @media print (see index.css).
// Rendered through a portal on <body>: the print stylesheet hides the whole
// app (caisse or admin) and keeps only this ticket, so it must never sit
// inside the page being hidden.
export function PrintTicket({ kind, order, wifi }: PrintJob) {
  // Le ticket du bar n'est pas un vrai ticket : juste la commande et
  // l'heure, sur la même imprimante que le ticket principal.
  if (kind === 'barman') {
    return createPortal(
      <div className="ticket-print ticket-barman">
        <div className="tp-row">
          <span>N° {order.ticketNumber}</span>
          <span>{formatDate(order.createdAt)}</span>
        </div>
        <div className="tp-rule" />
        <ul className="tp-lines tp-lines-kitchen">
          {order.items.map((i) => (
            <li key={i.id}>
              <span className="tp-qty">{i.quantity} ×</span>
              <span>{i.productName}</span>
            </li>
          ))}
        </ul>
      </div>,
      document.body,
    );
  }

  const paid = kind === 'receipt' && order.status === 'paid';
  // Le bon de cuisine est un ticket de préparation : gros caractères, sans prix.
  const prep = kind === 'kitchen';

  return createPortal(
    <div className={`ticket-print ticket-${kind}`}>
      <div className="tp-center">
        <img className="tp-logo" src={LOGO_MARK_DATA_URL} alt="" width={38} height={52} />
        <div className="tp-brand">{RESTAURANT.name}</div>
        {!prep && (
          <>
            <div>{RESTAURANT.subtitle}</div>
            <div>{RESTAURANT.address}</div>
            <div>{RESTAURANT.phone}</div>
          </>
        )}
      </div>

      <div className="tp-rule" />
      <div className="tp-title">{TITLES[kind]}</div>
      <div className="tp-row">
        <span>N° {order.ticketNumber}</span>
        <span>{formatDate(paid && order.paidAt ? order.paidAt : order.createdAt)}</span>
      </div>
      <div className="tp-where">{orderLabel(order)}</div>
      {order.waiterName && <div>Serveur : {order.waiterName}</div>}
      <div className="tp-rule" />

      {prep ? (
        <ul className="tp-lines tp-lines-kitchen">
          {order.items.map((i) => (
            <li key={i.id}>
              <span className="tp-qty">{i.quantity} ×</span>
              <span>{i.productName}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="tp-lines">
          {order.items.map((i) => (
            <li key={i.id}>
              <span className="tp-name">
                {i.quantity} × {i.productName}
              </span>
              <span className="tp-amount">{formatPrice(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
      )}

      {order.note && <div className="tp-note">Note : {order.note}</div>}

      {!prep && (
        <>
          <div className="tp-rule" />
          {order.discount > 0 && (
            <>
              <div className="tp-row">
                <span>Sous-total</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="tp-row">
                <span>Remise</span>
                <span>- {formatPrice(order.discount)}</span>
              </div>
            </>
          )}
          <div className="tp-row tp-total">
            <span>TOTAL</span>
            <span>{formatPrice(order.total)}</span>
          </div>

          {paid ? (
            <>
              <div className="tp-row">
                <span>{order.paymentMethod === 'cash' ? 'Espèces' : 'Carte bancaire'}</span>
                <span>{formatPrice(order.amountPaid ?? order.total)}</span>
              </div>
              {order.paymentMethod === 'cash' && (
                <div className="tp-row">
                  <span>Rendu</span>
                  <span>{formatPrice(order.changeGiven)}</span>
                </div>
              )}
            </>
          ) : (
            <div className="tp-center tp-unpaid">Non payé</div>
          )}

          <div className="tp-rule" />
          {(wifi?.name || wifi?.password) && (
            <div className="tp-center tp-wifi">
              <div className="tp-title">WIFI</div>
              {wifi.name && <div>{wifi.name}</div>}
              {wifi.password && <div>Mot de passe : {wifi.password}</div>}
            </div>
          )}
          <div className="tp-center tp-footer">{RESTAURANT.footer}</div>
        </>
      )}
    </div>,
    document.body,
  );
}
