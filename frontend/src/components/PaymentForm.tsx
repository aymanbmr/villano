import { useState } from 'react';
import { formatPrice, type PaymentMethod, type PayOrderPayload } from '../api';
import { Icon } from './Icon';

interface Props {
  /** Libellé du bouton : l'encaissement initial ou sa correction. */
  action?: string;
  subtotal: number;
  submitting: boolean;
  error: string | null;
  onSubmit: (payload: PayOrderPayload) => void;
}

const QUICK_AMOUNTS = [10, 20, 50, 100, 200];

// Payment inputs used when settling an order: discount, cash/card,
// amount received and the change to give back.
export function PaymentForm({ subtotal, submitting, error, onSubmit, action = 'Encaisser' }: Props) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discount, setDiscount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');

  const discountValue = Math.min(Number(discount) || 0, subtotal);
  const total = Math.round((subtotal - discountValue) * 100) / 100;
  // Rien de saisi : le compte est juste. C'est le cas d'une correction sur une
  // commande deja encaissee, ou le montant n'a pas a etre resaisi.
  const paid = paymentMethod === 'card' || amountPaid.trim() === '' ? total : Number(amountPaid) || 0;
  const change = Math.round((paid - total) * 100) / 100;
  const canSubmit = !submitting && paid >= total;

  const submit = () =>
    onSubmit({
      paymentMethod,
      amountPaid: paymentMethod === 'cash' ? paid : undefined,
      discount: discountValue > 0 ? discountValue : undefined,
    });

  return (
    <div className="payment">
      <div className="totals">
        <div>
          <span>Sous-total</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="discount-row">
          <span>Remise</span>
          <input
            className="input input-sm"
            type="number"
            min={0}
            step="0.5"
            placeholder="0"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>
        <div className="strong">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      <div className="segmented">
        <button
          type="button"
          className={paymentMethod === 'cash' ? 'is-active' : ''}
          onClick={() => setPaymentMethod('cash')}
        >
          <Icon name="cash" size={16} /> Espèces
        </button>
        <button
          type="button"
          className={paymentMethod === 'card' ? 'is-active' : ''}
          onClick={() => setPaymentMethod('card')}
        >
          <Icon name="card" size={16} /> Carte
        </button>
      </div>

      {paymentMethod === 'cash' && (
        <div className="cash-box">
          <input
            className="input"
            type="number"
            min={0}
            step="0.5"
            placeholder="Montant reçu"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
          />
          <div className="quick-amounts">
            <button type="button" onClick={() => setAmountPaid(String(total))}>
              Exact
            </button>
            {QUICK_AMOUNTS.map((a) => (
              <button key={a} type="button" onClick={() => setAmountPaid(String(a))}>
                {a}
              </button>
            ))}
          </div>
          <div className={`change-line${change < 0 ? ' is-negative' : ''}`}>
            <span>{change < 0 ? 'Manque' : 'À rendre'}</span>
            <span>{formatPrice(Math.abs(change))}</span>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <button
        type="button"
        className="btn btn-primary btn-block btn-lg"
        disabled={!canSubmit}
        onClick={submit}
      >
        {submitting ? 'Enregistrement…' : `${action} ${formatPrice(total)}`}
      </button>
    </div>
  );
}
