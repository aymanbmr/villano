import { useState } from 'react';
import { ApiError, workDayApi, type WorkDay } from '../api';
import { Icon } from './Icon';

interface Props {
  onOpened: (day: WorkDay) => void;
}

// Shown instead of the caisse when no work day is open: the cashier must
// start service by hand before taking orders (and stays open across
// midnight until someone closes it, on purpose).
export function DayClosedScreen({ onOpened }: Props) {
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
        <p className="login-title">Ouvrez la journée pour commencer à prendre des commandes.</p>

        {error && <div className="error login-error">{error}</div>}

        <button type="button" className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={start}>
          {busy ? 'Ouverture…' : 'Ouvrir la journée'}
        </button>
      </div>
    </div>
  );
}
