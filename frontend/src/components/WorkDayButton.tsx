import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ApiError, formatPrice, printingApi, workDayApi, type WaiterTotals, type WorkDay } from '../api';
import { Icon } from './Icon';
import { canManageWorkDay, useSession } from '../auth';
import { agentPresent, imprimerParAgent } from '../printing/agent';
import { printerFor, renderClosingTicket } from '../printing/ticket';

interface Props {
  workDay: WorkDay;
  pendingCount: number;
  onClosed: () => void;
}

// Per-waiter takings, the figure the manager checks at closing time.
function WaiterBreakdown({ rows, total }: { rows: WaiterTotals[]; total: number }) {
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
            <tr key={row.waiterId ?? 'sans'}>
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
            <td className="num">{formatPrice(rows.reduce((s, r) => s + r.cash, 0))}</td>
            <td className="num">{formatPrice(rows.reduce((s, r) => s + r.card, 0))}</td>
            <td className="num">{formatPrice(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

// Shown in the app bar while no day is open — typically after « Plus tard »:
// one click brings the opening popup back. Waiters see it greyed out, since
// only the cashier, the manager and the owner may open the day.
export function OpenDayButton({ onOpen }: { onOpen: () => void }) {
  const session = useSession();
  const allowed = canManageWorkDay(session?.user);
  return (
    <button
      type="button"
      className="btn btn-bar workday-pill is-closed"
      onClick={() => allowed && onOpen()}
      aria-disabled={!allowed}
      title={
        allowed
          ? 'Aucune journée ouverte — cliquer pour ouvrir'
          : 'Aucune journée ouverte — le caissier doit l’ouvrir'
      }
    >
      <Icon name="clipboard" size={15} />
      <span className="hide-sm">{allowed ? 'Ouvrir la journée' : 'Journée fermée'}</span>
    </button>
  );
}

// AppBar pill showing the open day's start time; click opens the closing
// summary popup (revenue so far, then a manual confirmation to close).
export function WorkDayButton({ workDay, pendingCount, onClosed }: Props) {
  const session = useSession();
  const mayClose = canManageWorkDay(session?.user);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  // A day coming straight from the opening call (or from the offline cache)
  // may not carry its summary yet: never crash the caisse for that.
  const summary = workDay.summary ?? { orders: 0, revenue: 0, cash: 0, card: 0, byWaiter: [] };

  const confirmClose = async () => {
    setBusy(true);
    setError(null);
    try {
      await workDayApi.close(workDay.id);
      setOpen(false);
      onClosed();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur réseau, réessayez.');
    } finally {
      setBusy(false);
    }
  };

  // Le caissier compte les espèces du tiroir à la clôture : une trace papier
  // du total attendu évite d'avoir à se fier seulement à l'écran.
  const printClosing = async () => {
    setPrinting(true);
    setPrintError(null);
    try {
      const config = await printingApi.config();
      const printer = config && printerFor('receipt', config);
      if (!config || !printer) {
        setPrintError("Aucune imprimante comptoir configurée (Admin → Imprimantes).");
        return;
      }
      if (!(await agentPresent())) {
        setPrintError('Agent d’impression introuvable sur ce poste.');
        return;
      }
      const payload = renderClosingTicket(
        { openedAt: workDay.openedAt, closedAt: workDay.closedAt, openedBy: workDay.openedBy, closedBy: workDay.closedBy },
        summary,
        config,
        printer,
      );
      const printed = await imprimerParAgent({ host: printer.host, port: printer.port, payload });
      if (!printed) setPrintError('L’imprimante n’a pas répondu.');
    } catch {
      setPrintError('Erreur réseau, réessayez.');
    } finally {
      setPrinting(false);
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
        <span className="hide-sm">Journée depuis {timeOf(workDay.openedAt)}</span>
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
                  <span>{summary.orders}</span>
                </div>
                <div>
                  <span>Espèces</span>
                  <span>{formatPrice(summary.cash)}</span>
                </div>
                <div>
                  <span>Carte</span>
                  <span>{formatPrice(summary.card)}</span>
                </div>
                <div className="strong">
                  <span>Total</span>
                  <span>{formatPrice(summary.revenue)}</span>
                </div>
              </div>

              <WaiterBreakdown rows={summary.byWaiter} total={summary.revenue} />

              {pendingCount > 0 && (
                <div className="hint">
                  <Icon name="alert" size={15} /> {pendingCount} commande
                  {pendingCount > 1 ? 's' : ''} encore en cours. Encaissez
                  {pendingCount > 1 ? '-les' : '-la'} ou annulez
                  {pendingCount > 1 ? '-les' : '-la'} avant de clôturer la journée.
                </div>
              )}
              {error && <div className="error">{error}</div>}
              {printError && <div className="error">{printError}</div>}

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" disabled={printing} onClick={() => void printClosing()}>
                  <Icon name="printer" size={15} /> {printing ? 'Impression…' : 'Imprimer'}
                </button>
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
                  // A day can only be closed once every order is settled
                  disabled={busy || pendingCount > 0}
                  title={
                    pendingCount > 0 ? 'Des commandes sont encore en cours' : 'Clôturer la journée'
                  }
                  onClick={confirmClose}
                >
                  {busy ? 'Clôture…' : 'Clôturer la journée'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
