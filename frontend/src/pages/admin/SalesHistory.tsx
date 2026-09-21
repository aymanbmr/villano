import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, formatPrice, orderLabel, statsApi, type Order, type OrderStatus } from '../../api';
import { Icon } from '../../components/Icon';
import { PrintTicket } from '../../components/PrintTicket';
import { usePrint } from '../../usePrint';
import { RangePicker, defaultRange, type Range } from './RangePicker';
import { formatDateTime } from './dateRange';

type Filter = Extract<OrderStatus, 'paid' | 'cancelled'>;

// Every order of the period with its lines: the "every detail" view
export function SalesHistory() {
  const [range, setRange] = useState<Range>(defaultRange);
  const [status, setStatus] = useState<Filter>('paid');
  const [orders, setOrders] = useState<Order[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { job, print } = usePrint();

  const load = useCallback(async () => {
    setError(null);
    try {
      setOrders(await statsApi.orders(status, range.from, range.to, 500));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur réseau');
    }
  }, [status, range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.ticketNumber.toLowerCase().includes(q) ||
        (o.tableNumber ?? '').toLowerCase() === q ||
        o.items.some((i) => i.productName.toLowerCase().includes(q)),
    );
  }, [orders, search]);

  const total = visible.reduce((s, o) => s + o.total, 0);

  const cancel = async (o: Order) => {
    if (!window.confirm(`Annuler la commande ${o.ticketNumber} (${formatPrice(o.total)}) ?\nLe stock sera remis et elle sortira du chiffre d'affaires.`)) return;
    try {
      await api.cancelOrder(o.id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur réseau');
    }
  };

  return (
    <div className="sales">
      <div className="dash-head">
        <div>
          <h2 className="page-title">Détail des ventes</h2>
          <div className="muted">
            {visible.length} commande{visible.length > 1 ? 's' : ''} · {formatPrice(total)}
          </div>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </div>

      <div className="toolbar">
        <div className="segmented segmented-sm segmented-inline">
          <button type="button" className={status === 'paid' ? 'is-active' : ''} onClick={() => setStatus('paid')}>
            Encaissées
          </button>
          <button type="button" className={status === 'cancelled' ? 'is-active' : ''} onClick={() => setStatus('cancelled')}>
            Annulées
          </button>
        </div>
        <input
          type="search"
          className="search"
          placeholder="N° ticket, table ou produit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="error">{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Date</th>
            <th>Table</th>
            <th>Articles</th>
            <th>Paiement</th>
            <th className="num">Total</th>
            <th className="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={7} className="empty">
                Aucune commande sur cette période.
              </td>
            </tr>
          )}
          {visible.map((o) => {
            const expanded = open === o.id;
            const count = o.items.reduce((s, i) => s + i.quantity, 0);
            return (
              <tr key={o.id} className={expanded ? 'is-open' : ''}>
                <td data-label="Ticket">
                  <button type="button" className="btn-link ticket-link" onClick={() => setOpen(expanded ? null : o.id)}>
                    {o.ticketNumber}
                  </button>
                </td>
                <td data-label="Date">{formatDateTime(o.paidAt ?? o.createdAt)}</td>
                <td data-label="Table">{orderLabel(o)}</td>
                <td data-label="Articles">
                  {expanded ? (
                    <ul className="order-lines">
                      {o.items.map((i) => (
                        <li key={i.id}>
                          <span>
                            {i.quantity} × {i.productName}
                          </span>
                          <span>{formatPrice(i.lineTotal)}</span>
                        </li>
                      ))}
                      {o.discount > 0 && (
                        <li className="muted">
                          <span>Remise</span>
                          <span>- {formatPrice(o.discount)}</span>
                        </li>
                      )}
                      {o.note && <li className="muted">Note : {o.note}</li>}
                    </ul>
                  ) : (
                    <button type="button" className="btn-link" onClick={() => setOpen(o.id)}>
                      {count} article{count > 1 ? 's' : ''} · {o.items.map((i) => i.productName).slice(0, 3).join(', ')}
                      {o.items.length > 3 ? '…' : ''}
                    </button>
                  )}
                </td>
                <td data-label="Paiement">
                  {o.status === 'cancelled' ? (
                    <span className="status status-off">Annulée</span>
                  ) : o.paymentMethod === 'cash' ? (
                    <span className="status is-cash-text">Espèces</span>
                  ) : (
                    <span className="status is-card-text">Carte</span>
                  )}
                </td>
                <td className="num" data-label="Total">
                  <b>{formatPrice(o.total)}</b>
                </td>
                <td className="actions">
                  {o.status === 'paid' && (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => print({ kind: 'receipt', order: o })} title="Réimprimer le ticket">
                        <Icon name="printer" size={14} />
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => cancel(o)} title="Annuler la commande">
                        <Icon name="x" size={14} /> Annuler
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {job && <PrintTicket {...job} />}
    </div>
  );
}
