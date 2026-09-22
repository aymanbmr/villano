import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { discardFailed, sync, useOffline, watchConnection } from '../offline';

interface Props {
  // Called after a successful sync so the caisse reloads server data
  onSynced: () => void;
}

// Shows the connection state and what is still waiting to be sent.
// Hidden entirely when online with an empty outbox (the normal case).
export function ConnectionBanner({ onSynced }: Props) {
  const { online, pending, syncing, lastError } = useOffline();
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => watchConnection(), []);

  // Back online with a queue: flush it, then refresh the caisse
  useEffect(() => {
    if (!online || pending === 0 || syncing) return;
    let cancelled = false;
    void sync().then((r) => {
      if (cancelled || r.sent === 0) return;
      setJustSynced(true);
      onSynced();
      setTimeout(() => setJustSynced(false), 4000);
    });
    return () => {
      cancelled = true;
    };
  }, [online, pending, syncing, onSynced]);

  if (online && pending === 0) {
    return justSynced ? (
      <div className="conn-banner is-ok">
        <Icon name="check" size={16} />
        <span>Commandes hors ligne envoyées au serveur.</span>
      </div>
    ) : null;
  }

  return (
    <div className={`conn-banner${online ? ' is-sync' : ' is-off'}`}>
      <Icon name={online ? 'cart' : 'alert'} size={16} />
      <span>
        {online
          ? syncing
            ? `Envoi en cours… ${pending} en attente`
            : `${pending} commande(s) en attente d'envoi`
          : `Hors ligne — les commandes sont enregistrées ici${pending ? ` (${pending} en attente)` : ''}`}
      </span>
      {lastError && <span className="conn-error">{lastError}</span>}
      {online && !syncing && (
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() =>
            void sync().then((r) => {
              if (r.sent > 0) onSynced();
            })
          }
        >
          Réessayer
        </button>
      )}
      {lastError && (
        <button
          type="button"
          className="btn btn-sm btn-ghost btn-danger"
          onClick={() => {
            discardFailed();
            onSynced();
          }}
          title="Retirer de la file les commandes refusées par le serveur"
        >
          Abandonner
        </button>
      )}
    </div>
  );
}
