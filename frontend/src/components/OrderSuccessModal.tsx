import { formatPrice, orderLabel, type Order } from '../api';

interface Props {
  order: Order;
  onClose: () => void;
  onPrint: () => void;
}

export function OrderSuccessModal({ order, onClose, onPrint }: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-check">✓</div>
        <h2>Commande encaissée</h2>
        <p className="ticket">
          Ticket n° {order.ticketNumber}
          {" · " + orderLabel(order)}
        </p>

        <ul className="receipt">
          {order.items.map((i) => (
            <li key={i.id}>
              <span>
                {i.quantity} × {i.productName}
              </span>
              <span>{formatPrice(i.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <div className="receipt-totals">
          {order.discount > 0 && (
            <div>
              <span>Remise</span>
              <span>- {formatPrice(order.discount)}</span>
            </div>
          )}
          <div className="strong">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
          <div>
            <span>{order.paymentMethod === 'cash' ? 'Reçu (espèces)' : 'Carte'}</span>
            <span>{formatPrice(order.amountPaid ?? order.total)}</span>
          </div>
          {order.paymentMethod === 'cash' && (
            <div className="change">
              <span>À rendre</span>
              <span>{formatPrice(order.changeGiven)}</span>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onPrint}>
            🖨 Imprimer le ticket
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
            Nouvelle commande
          </button>
        </div>
      </div>
    </div>
  );
}
