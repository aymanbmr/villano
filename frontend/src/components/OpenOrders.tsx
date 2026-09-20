import { useEffect, useState } from 'react';
import {
  formatPrice,
  orderLabel,
  type Order,
  type PayOrderPayload,
  type UpdateOrderPayload,
} from '../api';
import { PaymentForm } from './PaymentForm';
import type { TicketKind } from './PrintTicket';

interface Props {
  orders: Order[];
  selectedId: number | null;
  busy: boolean;
  error: string | null;
  onSelect: (id: number | null) => void;
  onPay: (order: Order, payload: PayOrderPayload) => void;
  onAddItems: (order: Order) => void;
  onUpdate: (order: Order, payload: UpdateOrderPayload) => void;
  onUpdateItem: (order: Order, itemId: number, quantity: number) => void;
  onDelete: (order: Order) => void;
  onPrint: (order: Order, kind: TicketKind) => void;
}

function elapsed(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

// Orders sent to the kitchen and waiting to be paid. Selecting one shows
// its lines (editable), the header (table / note) and the payment form.
export function OpenOrders({
  orders,
  selectedId,
  busy,
  error,
  onSelect,
  onPay,
  onAddItems,
  onUpdate,
  onUpdateItem,
  onDelete,
  onPrint,
}: Props) {
  if (orders.length === 0) {
    return (
      <div className="cart-body">
        <p className="empty">Aucune commande en cours.</p>
      </div>
    );
  }

  return (
    <div className="cart-body">
      <ul className="open-orders">
        {orders.map((order) => {
          const selected = order.id === selectedId;
          return (
            <li key={order.id} className={`open-order${selected ? ' is-selected' : ''}`}>
              <button
                type="button"
                className="open-order-head"
                onClick={() => onSelect(selected ? null : order.id)}
              >
                <div>
                  <div className="open-order-title">{orderLabel(order)}</div>
                  <div className="muted">
                    {order.ticketNumber} · {order.items.reduce((s, i) => s + i.quantity, 0)} article(s)
                    · {elapsed(order.createdAt)}
                  </div>
                </div>
                <div className="open-order-total">{formatPrice(order.total)}</div>
              </button>

              {selected && (
                <OrderDetail
                  order={order}
                  busy={busy}
                  error={error}
                  onPay={onPay}
                  onAddItems={onAddItems}
                  onUpdate={onUpdate}
                  onUpdateItem={onUpdateItem}
                  onDelete={onDelete}
                  onPrint={onPrint}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type DetailProps = Omit<Props, 'orders' | 'selectedId' | 'onSelect'> & { order: Order };

function OrderDetail({
  order,
  busy,
  error,
  onPay,
  onAddItems,
  onUpdate,
  onUpdateItem,
  onDelete,
  onPrint,
}: DetailProps) {
  // Local copies of the editable header fields; saved on blur / toggle
  const [tableNumber, setTableNumber] = useState(order.tableNumber ?? '');
  const [note, setNote] = useState(order.note ?? '');

  useEffect(() => {
    setTableNumber(order.tableNumber ?? '');
    setNote(order.note ?? '');
  }, [order.tableNumber, order.note]);

  const saveTable = () => {
    const value = tableNumber.trim();
    if (value === '') {
      setTableNumber(order.tableNumber ?? ''); // a dine-in order keeps its table
      return;
    }
    if (value !== order.tableNumber) onUpdate(order, { tableNumber: value });
  };

  const switchToDineIn = () => {
    if (order.orderType === 'dine_in') return;
    const table = window.prompt('Numéro de table ?')?.trim();
    if (table) onUpdate(order, { orderType: 'dine_in', tableNumber: table });
  };
  const saveNote = () => {
    const value = note.trim();
    if (value !== (order.note ?? '')) onUpdate(order, { note: value || null });
  };

  const changeQty = (itemId: number, quantity: number) => {
    if (quantity <= 0 && order.items.length === 1) {
      if (window.confirm(`Retirer le dernier article supprime la commande ${order.ticketNumber}. Continuer ?`)) {
        onDelete(order);
      }
      return;
    }
    onUpdateItem(order, itemId, Math.max(0, quantity));
  };

  return (
    <div className="open-order-detail">
      <div className="segmented">
        <button
          type="button"
          className={order.orderType === 'dine_in' ? 'is-active' : ''}
          disabled={busy}
          onClick={switchToDineIn}
        >
          Sur place
        </button>
        <button
          type="button"
          className={order.orderType === 'takeaway' ? 'is-active' : ''}
          disabled={busy}
          onClick={() => order.orderType !== 'takeaway' && onUpdate(order, { orderType: 'takeaway' })}
        >
          À emporter
        </button>
      </div>
      {order.orderType === 'dine_in' && (
        <input
          className="input"
          placeholder="N° de table (obligatoire)"
          value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
          onBlur={saveTable}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      )}

      <ul className="cart-lines edit-lines">
        {order.items.map((i) => (
          <li key={i.id} className="cart-line">
            <div className="cart-line-info">
              <div className="cart-line-name">{i.productName}</div>
              <div className="cart-line-price">
                {formatPrice(i.unitPrice)} × {i.quantity}
              </div>
            </div>
            <div className="qty">
              <button type="button" disabled={busy} onClick={() => changeQty(i.id, i.quantity - 1)}>
                −
              </button>
              <span>{i.quantity}</span>
              <button type="button" disabled={busy} onClick={() => changeQty(i.id, i.quantity + 1)}>
                +
              </button>
            </div>
            <div className="cart-line-total">{formatPrice(i.lineTotal)}</div>
            <button
              type="button"
              className="cart-line-remove"
              disabled={busy}
              onClick={() => changeQty(i.id, 0)}
              aria-label="Retirer"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <input
        className="input"
        placeholder="Note pour la cuisine"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />

      <div className="open-order-actions">
        <button type="button" className="btn btn-ghost" onClick={() => onPrint(order, 'kitchen')}>
          🖨 Cuisine
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => onPrint(order, 'bill')}>
          🖨 Addition
        </button>
      </div>
      <div className="open-order-actions">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onAddItems(order)}>
          + Ajouter des articles
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-danger"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`Supprimer la commande ${order.ticketNumber} ? Le stock sera remis.`)) {
              onDelete(order);
            }
          }}
        >
          🗑 Supprimer
        </button>
      </div>

      <PaymentForm
        key={order.id}
        subtotal={order.subtotal}
        submitting={busy}
        error={error}
        onSubmit={(payload) => onPay(order, payload)}
      />
    </div>
  );
}
