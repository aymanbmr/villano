import { useState } from "react";
import { createPortal } from "react-dom";
import {
  ApiError,
  formatPrice,
  workDayApi,
  type WaiterTotals,
  type WorkDay,
} from "../api";
import { Icon } from "./Icon";
import { canManageWorkDay, useSession } from "../auth";

interface Props {
  workDay: WorkDay;
  pendingCount: number;
  onClosed: () => void;
}

// Per-waiter takings, the figure the manager checks at closing time.
function WaiterBreakdown({
  rows,
  total,
}: {
  rows: WaiterTotals[];
  total: number;
}) {
  if (!rows?.length) return null;
  return (
    <div className="waiter-breakdown">
      <div className="breakdown-title">Par serveur</div>
      <table className="breakdown">
        <thead>
          <tr>
            <th>Serveur</th>
            <th className="num">Cmd.</th>
            <th className="num">Espèces</th>
            <th className="num">Carte</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.waiterId ?? "sans"}>
              <td>{row.waiterName}</td>
              <td className="num">{row.orders}</td>
              <td className="num">{formatPrice(row.cash)}</td>
              <td className="num">{formatPrice(row.card)}</td>
              <td className="num strong-text">{formatPrice(row.revenue)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="num">{rows.reduce((s, r) => s + r.orders, 0)}</td>
            <td className="num">
              {formatPrice(rows.reduce((s, r) => s + r.cash, 0))}
            </td>
            <td className="num">
              {formatPrice(rows.reduce((s, r) => s + r.card, 0))}
            </td>
            <td className="num">{formatPrice(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

// AppBar pill showing the open day's start time; click opens the closing
// summary popup (revenue so far, then a manual confirmation to close).
export function WorkDayButton({ workDay, pendingCount, onClosed }: Props) {
  const session = useSession();
  const mayClose = canManageWorkDay(session?.user);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmClose = async () => {
    setBusy(true);
    setError(null);
    try {
      await workDayApi.close(workDay.id);
      setOpen(false);
      onClosed();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur réseau, réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-bar workday-pill"
        onClick={() => mayClose && setOpen(true)}
        aria-disabled={!mayClose}
        title={
          mayClose
            ? `Journée ouverte depuis ${timeOf(workDay.openedAt)} — cliquer pour clôturer`
            : `Journée ouverte depuis ${timeOf(workDay.openedAt)} — seul le caissier peut clôturer`
        }
      >
        <Icon name="clipboard" size={15} />
        <span className="hide-sm">
          Journée depuis {timeOf(workDay.openedAt)}
        </span>
      </button>

      {open &&
        mayClose &&
        // Rendered on <body>: this button lives in the dark app bar, and a modal
        // nested there would inherit its white text.
        createPortal(
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            onClick={() => !busy && setOpen(false)}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-check">
                <Icon name="clipboard" size={28} />
              </div>
              <h2>Clôturer la journée ?</h2>
              <p className="ticket">
                Ouverte par {workDay.openedBy} à {timeOf(workDay.openedAt)}
              </p>

              <div className="receipt-totals">
                <div>
                  <span>Commandes encaissées</span>
                  <span>{workDay.summary.orders}</span>
                </div>
                <div>
                  <span>Espèces</span>
                  <span>{formatPrice(workDay.summary.cash)}</span>
                </div>
                <div>
                  <span>Carte</span>
                  <span>{formatPrice(workDay.summary.card)}</span>
                </div>
                <div className="strong">
                  <span>Total</span>
                  <span>{formatPrice(workDay.summary.revenue)}</span>
                </div>
              </div>

              <WaiterBreakdown
                rows={workDay.summary.byWaiter}
                total={workDay.summary.revenue}
              />

              {pendingCount > 0 && (
                <div className="hint">
                  {pendingCount} commande{pendingCount > 1 ? "s" : ""} encore en
                  cours (non encaissée
                  {pendingCount > 1 ? "s" : ""}). Vous pourrez toujours les
                  encaisser après la clôture.
                </div>
              )}
              {error && <div className="error">{error}</div>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={confirmClose}
                >
                  {busy ? "Clôture…" : "Clôturer la journée"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
