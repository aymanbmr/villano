import { createPortal } from 'react-dom';
import { formatPrice, type WaiterTotals, type WorkDay } from '../api';
import { RESTAURANT } from '../config';

export interface ClosingTicketData {
  workDay: Pick<WorkDay, 'openedAt' | 'closedAt' | 'openedBy' | 'closedBy'>;
  summary: { orders: number; revenue: number; cash: number; card: number; byWaiter: WaiterTotals[] };
}

const dateTime = (iso: string | Date) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// Dernier recours quand l'agent de la caisse n'est pas joignable : le
// navigateur imprime lui-même, comme pour les tickets de commande.
export function ClosingTicket({ workDay, summary }: ClosingTicketData) {
  return createPortal(
    <div className="ticket-print ticket-closing">
      <div className="tp-center">
        <div className="tp-brand">{RESTAURANT.name}</div>
        <div>{RESTAURANT.subtitle}</div>
      </div>
      <div className="tp-rule" />
      <div className="tp-title">CLÔTURE DE JOURNÉE</div>
      <div className="tp-row">
        <span>Ouverte par</span>
        <span>{workDay.openedBy}</span>
      </div>
      <div className="tp-row">
        <span>Depuis</span>
        <span>{dateTime(workDay.openedAt)}</span>
      </div>
      <div className="tp-row">
        <span>Clôturée par</span>
        <span>{workDay.closedBy ?? '—'}</span>
      </div>
      <div className="tp-row">
        <span>Le</span>
        <span>{dateTime(workDay.closedAt ?? new Date())}</span>
      </div>
      <div className="tp-rule" />
      <div className="tp-row">
        <span>Commandes encaissées</span>
        <span>{summary.orders}</span>
      </div>
      <div className="tp-row">
        <span>Espèces</span>
        <span>{formatPrice(summary.cash)}</span>
      </div>
      <div className="tp-row">
        <span>Carte</span>
        <span>{formatPrice(summary.card)}</span>
      </div>
      <div className="tp-row tp-total">
        <span>TOTAL</span>
        <span>{formatPrice(summary.revenue)}</span>
      </div>

      {summary.byWaiter.length > 0 && (
        <>
          <div className="tp-rule" />
          <div className="tp-title">PAR SERVEUR</div>
          <ul className="tp-lines">
            {summary.byWaiter.map((row) => (
              <li key={row.waiterId ?? 'sans'}>
                <span className="tp-name">{row.waiterName}</span>
                <span className="tp-amount">{formatPrice(row.revenue)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="tp-rule" />
      <div className="tp-center tp-footer">{RESTAURANT.footer}</div>
    </div>,
    document.body,
  );
}
