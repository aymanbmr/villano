import { useEffect, useState } from 'react';
import {
  formatPrice,
  orderLabel,
  type CreateOrderPayload,
  type Order,
  type OrderType,
  type StaffMember,
} from '../api';
import type { CartLine } from '../useCart';
import { Icon } from './Icon';
import { SHOW_STOCK } from '../config';
import { TablePicker } from './TablePicker';
import { WaiterPicker } from './WaiterPicker';

interface Props {
  lines: CartLine[];
  subtotal: number;
  submitting: boolean;
  error: string | null;
  // When set, the cart adds lines to this open order instead of creating one
  appendTo: Order | null;
  // Table numbers already busy with another open dine-in order
  occupiedTables: string[];
  staff: StaffMember[];
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
  occupiedTables,
  staff,
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
  const [waiter, setWaiter] = useState<StaffMember | null>(null);
  const [note, setNote] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [waiterPickerOpen, setWaiterPickerOpen] = useState(false);

  // Reset the header inputs whenever the cart is emptied (new order)
  useEffect(() => {
    if (lines.length === 0) {
      setTableNumber('');
      setWaiter(null);
      setNote('');
    }
  }, [lines.length]);

  // Dine-in orders must carry a table number and a responsible waiter
  // (also enforced by the API)
  const tableMissing = !appendTo && orderType === 'dine_in' && tableNumber.trim() === '';
  const waiterMissing = !appendTo && orderType === 'dine_in' && !waiter;

  const submit = () =>
    onSubmit({
      items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      orderType,
      tableNumber: orderType === 'dine_in' && tableNumber.trim() ? tableNumber.trim() : undefined,
      waiterId: waiter?.id,
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
            <>
              <button
                type="button"
                className={`table-select-btn${tableMissing && lines.length > 0 ? ' is-invalid' : ''}${tableNumber ? '' : ' is-empty'}`}
                onClick={() => setPickerOpen(true)}
              >
                <span className="row-icon">
                  <Icon name="grid" size={16} />
                  {tableNumber ? `Table ${tableNumber}` : 'Choisir une table (obligatoire)'}
                </span>
                <Icon name="edit" size={14} />
              </button>
              <button
                type="button"
                className={`table-select-btn${waiterMissing && lines.length > 0 ? ' is-invalid' : ''}${waiter ? '' : ' is-empty'}`}
                onClick={() => setWaiterPickerOpen(true)}
              >
                <span className="row-icon">
                  <Icon name="users" size={16} />
                  {waiter ? `${waiter.firstName} ${waiter.lastName}` : 'Choisir le serveur (obligatoire)'}
                </span>
                <Icon name="edit" size={14} />
              </button>
            </>
          )}
        </>
      )}

      {pickerOpen && (
        <TablePicker
          selected={tableNumber}
          occupied={occupiedTables}
          onSelect={(t) => {
            setTableNumber(t);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {waiterPickerOpen && (
        <WaiterPicker
          staff={staff}
          selectedId={waiter?.id ?? null}
          onSelect={(s) => {
            setWaiter(s);
            setWaiterPickerOpen(false);
          }}
          onClose={() => setWaiterPickerOpen(false)}
        />
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
              <button type="button" onClick={() => onSetQuantity(product.id, quantity - 1)} aria-label="Moins">
                <Icon name="minus" size={14} />
              </button>
              <span>{quantity}</span>
              <button
                type="button"
                onClick={() => onSetQuantity(product.id, quantity + 1)}
                disabled={SHOW_STOCK && quantity >= product.stock}
                title={SHOW_STOCK && quantity >= product.stock ? 'Stock maximum atteint' : undefined}
                aria-label="Plus"
              >
                <Icon name="plus" size={14} />
              </button>
            </div>
            <div className="cart-line-total">{formatPrice(product.price * quantity)}</div>
            <button
              type="button"
              className="cart-line-remove"
              onClick={() => onRemove(product.id)}
              aria-label="Retirer"
            >
              <Icon name="x" size={16} />
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
          <Icon name="printer" size={14} />
          Imprimer le bon de cuisine à l’envoi
        </label>

        {error && <div className="error">{error}</div>}
        {(tableMissing || waiterMissing) && lines.length > 0 && (
          <div className="hint">
            {tableMissing && waiterMissing
              ? 'Indiquez la table et le serveur pour envoyer la commande.'
              : tableMissing
                ? 'Indiquez le numéro de table pour envoyer la commande.'
                : 'Choisissez le serveur responsable pour envoyer la commande.'}
          </div>
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
            disabled={lines.length === 0 || submitting || tableMissing || waiterMissing}
            title={tableMissing || waiterMissing ? 'Indiquez la table et le serveur' : undefined}
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
