import { useEffect, useState } from 'react';
import { formatPrice, orderLabel, type CreateOrderPayload, type Order, type OrderType } from '../api';
import type { CartLine } from '../useCart';

interface Props {
  lines: CartLine[];
  subtotal: number;
  submitting: boolean;
  error: string | null;
  // When set, the cart adds lines to this open order instead of creating one
  appendTo: Order | null;
  onSetQuantity: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
  onClear: () => void;
  onSubmit: (payload: CreateOrderPayload) => void;
  onCancelAppend: () => void;
  autoPrintKitchen: boolean;
  onToggleAutoPrint: (value: boolean) => void;
}

export function CartPanel({
  lines,
  subtotal,
  submitting,
  error,
  appendTo,
  onSetQuantity,
  onRemove,
  onClear,
  onSubmit,
  onCancelAppend,
  autoPrintKitchen,
  onToggleAutoPrint,
}: Props) {
  const [orderType, setOrderType] = useState<OrderType>('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  const [note, setNote] = useState('');

  // Reset the header inputs whenever the cart is emptied (new order)
  useEffect(() => {
    if (lines.length === 0) {
      setTableNumber('');
      setNote('');
    }
  }, [lines.length]);

  // Dine-in orders must carry a table number (also enforced by the API)
  const tableMissing = !appendTo && orderType === 'dine_in' && tableNumber.trim() === '';

  const submit = () =>
    onSubmit({
      items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      orderType,
      tableNumber: orderType === 'dine_in' && tableNumber.trim() ? tableNumber.trim() : undefined,
      note: note.trim() || undefined,
    });

  return (
    <div className="cart-body">
      {appendTo ? (
        <div className="append-banner">
          <div>
            <strong>Ajout à la commande {appendTo.ticketNumber}</strong>
            <div className="muted">
              {orderLabel(appendTo)} ·{' '}
              {formatPrice(appendTo.total)} déjà commandés
            </div>
          </div>
          <button type="button" className="btn-link" onClick={onCancelAppend}>
            Annuler
          </button>
        </div>
      ) : (
        <>
          <div className="segmented">
            <button
              type="button"
              className={orderType === 'dine_in' ? 'is-active' : ''}
              onClick={() => setOrderType('dine_in')}
            >
              Sur place
            </button>
            <button
              type="button"
              className={orderType === 'takeaway' ? 'is-active' : ''}
              onClick={() => setOrderType('takeaway')}
            >
              À emporter
            </button>
          </div>
          {orderType === 'dine_in' && (
            <input
              className={`input${tableMissing && lines.length > 0 ? ' is-invalid' : ''}`}
              placeholder="N° de table (obligatoire)"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              required
            />
          )}
        </>
      )}

      <ul className="cart-lines">
        {lines.length === 0 && <li className="empty">Touchez un produit pour l’ajouter.</li>}
        {lines.map(({ product, quantity }) => (
          <li key={product.id} className="cart-line">
            <div className="cart-line-info">
              <div className="cart-line-name">{product.name}</div>
              <div className="cart-line-price">
                {formatPrice(product.price)} × {quantity}
              </div>
            </div>
            <div className="qty">
              <button type="button" onClick={() => onSetQuantity(product.id, quantity - 1)}>
                −
              </button>
              <span>{quantity}</span>
              <button
                type="button"
                onClick={() => onSetQuantity(product.id, quantity + 1)}
                disabled={quantity >= product.stock}
                title={quantity >= product.stock ? 'Stock maximum atteint' : undefined}
              >
                +
              </button>
            </div>
            <div className="cart-line-total">{formatPrice(product.price * quantity)}</div>
            <button
              type="button"
              className="cart-line-remove"
              onClick={() => onRemove(product.id)}
              aria-label="Retirer"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div className="cart-footer">
        <input
          className="input"
          placeholder="Note pour la cuisine (sans sucre, bien cuit…)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="totals">
          <div className="strong">
            <span>Total</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={autoPrintKitchen}
            onChange={(e) => onToggleAutoPrint(e.target.checked)}
          />
          Imprimer le bon de cuisine à l’envoi
        </label>

        {error && <div className="error">{error}</div>}
        {tableMissing && lines.length > 0 && (
          <div className="hint">Indiquez le numéro de table pour envoyer la commande.</div>
        )}

        <div className="cart-actions">
          {lines.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={onClear}>
              Vider
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={lines.length === 0 || submitting || tableMissing}
            title={tableMissing ? 'Indiquez le numéro de table' : undefined}
            onClick={submit}
          >
            {submitting
              ? 'Envoi…'
              : appendTo
                ? `Ajouter à la commande`
                : `Envoyer la commande`}
          </button>
        </div>
      </div>
    </div>
  );
}
