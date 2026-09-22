import { useState } from 'react';
import { ApiError, workDayApi, type WorkDay } from '../api';
import { canManageWorkDay, logout, useSession } from '../auth';
import { Icon } from './Icon';

interface Props {
  onOpened: (day: WorkDay) => void;
  onDismiss: () => void;
}

// Popup shown over the caisse when someone logs in and no day is open.
// The cashier starts service from here; the others are told to wait.
export function WorkDayModal({ onOpened, onDismiss }: Props) {
  const session = useSession();
  const allowed = canManageWorkDay(session?.user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      onOpened(await workDayApi.open());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur réseau, réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal workday-modal">
        <img className="modal-logo" src="/logo/villano-mark.png" alt="" width={44} height={60} />

        {allowed ? (
          <>
            <h2>Ouvrir la journée&nbsp;?</h2>
            <p className="ticket">
              {today} · {session?.user.name}
            </p>
            <p className="workday-text">
              La caisse n’enregistre des commandes qu’une fois la journée ouverte. Elle restera
              ouverte jusqu’à ce que vous la clôturiez.
            </p>

            {error && <div className="error">{error}</div>}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onDismiss} disabled={busy}>
                Plus tard
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={start}
                disabled={busy}
                autoFocus
              >
                {busy ? 'Ouverture…' : 'Ouvrir la journée'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>Caisse fermée</h2>
            <p className="workday-text">
              Le caissier ou le responsable doit ouvrir la journée avant que vous puissiez prendre
              des commandes.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={logout}>
                <Icon name="logout" size={16} /> Changer d’utilisateur
              </button>
              <button type="button" className="btn btn-primary" onClick={onDismiss}>
                Fermer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
