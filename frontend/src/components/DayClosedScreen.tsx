import { useState } from 'react';
import { ApiError, workDayApi, type WorkDay } from '../api';
import { canManageWorkDay, logout, useSession } from '../auth';
import { Icon } from './Icon';

interface Props {
  onOpened: (day: WorkDay) => void;
}

// Shown instead of the caisse when no work day is open. Only the cashier (or
// a manager/admin) starts service; the others are told to wait for them.
export function DayClosedScreen({ onOpened }: Props) {
  const session = useSession();
  const allowed = canManageWorkDay(session?.user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const day = await workDayApi.open();
      onOpened(day);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur réseau, réessayez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="modal-check">
          <Icon name="clipboard" size={30} />
        </div>
        <div className="login-brand">Journée fermée</div>

        {allowed ? (
          <>
            <p className="login-title">Ouvrez la journée pour commencer à prendre des commandes.</p>
            {error && <div className="error login-error">{error}</div>}
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              disabled={busy}
              onClick={start}
            >
              {busy ? 'Ouverture…' : 'Ouvrir la journée'}
            </button>
          </>
        ) : (
          <>
            <p className="login-title">
              La caisse n’est pas encore ouverte. Le caissier ou le responsable doit ouvrir la
              journée avant de prendre des commandes.
            </p>
            <button type="button" className="btn btn-ghost btn-block" onClick={logout}>
              <Icon name="logout" size={16} /> Changer d’utilisateur
            </button>
          </>
        )}
      </div>
    </div>
  );
}
