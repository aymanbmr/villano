import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, authApi } from '../api';
import { setSession } from '../auth';
import { RESTAURANT } from '../config';
import { Icon } from '../components/Icon';

type Mode = 'pin' | 'password';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];
const PIN_MAX = 6;

// Full-screen lock: employees type their PIN on the keypad, the owner can
// switch to the master admin password.
export function LoginPage() {
  const [mode, setMode] = useState<Mode>('pin');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (credentials: { pin?: string; password?: string }) => {
    setBusy(true);
    setError(null);
    try {
      const session = await authApi.login(credentials);
      setSession(session);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Serveur injoignable');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const press = (key: string) => {
    if (busy) return;
    setError(null);
    if (key === 'C') return setPin('');
    if (key === '⌫') return setPin((p) => p.slice(0, -1));
    setPin((p) => (p.length < PIN_MAX ? p + key : p));
  };

  // Auto-submit at 4 digits is tempting but PINs can be 4–6: use Enter/OK
  useEffect(() => {
    if (mode !== 'pin') return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('⌫');
      else if (e.key === 'Escape') press('C');
      else if (e.key === 'Enter' && pin.length >= 4) void submit({ pin });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pin, busy]);

  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    if (password) void submit({ password });
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand login-brand">{RESTAURANT.name}</div>
        <div className="muted">{RESTAURANT.subtitle}</div>

        <div className="segmented login-tabs">
          <button
            type="button"
            className={mode === 'pin' ? 'is-active' : ''}
            onClick={() => setMode('pin')}
          >
            <Icon name="keypad" size={16} /> Code PIN
          </button>
          <button
            type="button"
            className={mode === 'password' ? 'is-active' : ''}
            onClick={() => setMode('password')}
          >
            <Icon name="lock" size={16} /> Mot de passe admin
          </button>
        </div>

        {mode === 'pin' ? (
          <>
            <p className="login-title">Entrez votre code PIN</p>
            <div className="pin-dots" aria-label={`${pin.length} chiffres saisis`}>
              {Array.from({ length: PIN_MAX }, (_, i) => (
                <span key={i} className={`pin-dot${i < pin.length ? ' is-filled' : ''}`} />
              ))}
            </div>
            <div className="keypad">
              {KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`key${/\d/.test(k) ? '' : ' key-alt'}`}
                  onClick={() => press(k)}
                  disabled={busy}
                >
                  {k === '⌫' ? <Icon name="backspace" size={22} /> : k}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              disabled={busy || pin.length < 4}
              onClick={() => void submit({ pin })}
            >
              {busy ? 'Connexion…' : 'Se connecter'}
            </button>
          </>
        ) : (
          <form onSubmit={submitPassword}>
            <p className="login-title">Mot de passe administrateur</p>
            <input
              className="input login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              autoFocus
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={busy || !password}
            >
              {busy ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        )}

        {error && <div className="error login-error">{error}</div>}
      </div>
    </div>
  );
}
