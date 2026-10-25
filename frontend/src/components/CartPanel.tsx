import { useEffect, useState } from 'react';
import {
  formatPrice,
  orderLabel,
  type CreateOrderPayload,
  type Order,
  type OrderType,
  type PaymentMethod,
  type StaffMember,
  staffName,
} from '../api';
import type { CartLine } from '../useCart';
import { Icon } from './Icon';
import { SHOW_STOCK } from '../config';
import { WaiterPicker } from './WaiterPicker';
import { useSession } from '../auth';

interface Props {
  lines: CartLine[];
  subtotal: number;
  submitting: boolean;
  error: string | null;
  // When set, the cart adds lines to this open order instead of creating one
  appendTo: Order | null;
  // Table numbers already busy with another open dine-in order
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
  staff,
  onSetQuantity,
  onRemove,
  onClear,
  onSubmit,
  onCancelAppend,
  autoPrintKitchen,
  onToggleAutoPrint,
}: Props) {
  const session = useSession();
  // A waiter logged in on their own profile is necessarily the one
  // responsible for what they ring up: no point asking them to pick
  // themselves from a list. A cashier or manager still chooses, since they
  // take orders on behalf of whichever waiter served the table.
  const self = session?.user.role === 'serveur' ? staff.find((s) => s.id === session.user.id) : undefined;

  const [orderType, setOrderType] = useState<OrderType>('dine_in');
  const [waiter, setWaiter] = useState<StaffMember | null>(null);
  const [note, setNote] = useState('');
  const [waiterPickerOpen, setWaiterPickerOpen] = useState(false);
  // The order is settled as it is sent; cash unless told otherwise
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  // Reset the header inputs whenever the cart is emptied (new order)
  useEffect(() => {
    if (lines.length === 0) {
      setWaiter(null);
      setNote('');
      setPaymentMethod('cash');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length]);

  // `self` depends on the staff list, which can still be loading on the very
  // first renders: falling back to it here (rather than only at init/reset)
  // means a serveur's own profile always wins once it arrives, even if that
  // happens after the cart's header state was first set.
  const effectiveWaiter = self ?? waiter;

  // Every order answers to a waiter, who collects for it (also enforced by the API)
  const waiterMissing = !appendTo && !effectiveWaiter;

  const submit = () =>
    onSubmit({
      items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      orderType,
      waiterId: effectiveWaiter?.id ?? 0,
      waiterName: effectiveWaiter ? staffName(effectiveWaiter) : null,
      note: note.trim() || undefined,
      payment: { paymentMethod },
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
          {!self && (
            <button
              type="button"
              className={`table-select-btn${waiterMissing && lines.length > 0 ? ' is-invalid' : ''}${waiter ? '' : ' is-empty'}`}
              onClick={() => setWaiterPickerOpen(true)}
            >
              <span className="row-icon">
                <Icon name="users" size={16} />
                {waiter ? staffName(waiter) : 'Choisir le serveur (obligatoire)'}
              </span>
              <Icon name="edit" size={14} />
            </button>
          )}
          <div className="segmented">
            <button
              type="button"
              className={paymentMethod === 'cash' ? 'is-active' : ''}
              onClick={() => setPaymentMethod('cash')}
            >
              <Icon name="cash" size={15} /> Espèces
            </button>
            <button
              type="button"
              className={paymentMethod === 'card' ? 'is-active' : ''}
              onClick={() => setPaymentMethod('card')}
            >
              <Icon name="card" size={15} /> Carte
            </button>
          </div>
        </>
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
        {waiterMissing && lines.length > 0 && (
          <div className="hint">Choisissez le serveur responsable pour encaisser la commande.</div>
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
            disabled={lines.length === 0 || submitting || waiterMissing}
            title={waiterMissing ? 'Choisissez le serveur responsable' : undefined}
            onClick={submit}
          >
            {submitting
              ? 'Envoi…'
              : appendTo
                ? `Ajouter à la commande`
                : `Encaisser ${formatPrice(subtotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
