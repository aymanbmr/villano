import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  printingApi,
  type FoundPrinter,
  type PrinterConfig,
  type PrinterId,
  type PrintingConfig,
} from '../../api';
import { Icon } from '../../components/Icon';
import { refreshPrintingConfig } from '../../usePrint';

const fail = (e: unknown) => (e instanceof ApiError ? e.message : 'Erreur réseau');

interface CardProps {
  title: string;
  hint: string;
  value: PrinterConfig;
  busy: boolean;
  onChange: (patch: Partial<PrinterConfig>) => void;
  onTest: () => void;
}

function PrinterCard({ title, hint, value, busy, onChange, onTest }: CardProps) {
  return (
    <section className="card printer-card">
      <div className="card-head">
        <h3>{title}</h3>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          Activée
        </label>
      </div>
      <p className="muted printer-hint">{hint}</p>

      <div className="form-grid">
        <label className="field">
          <span>Adresse IP</span>
          <input
            className="input"
            value={value.host}
            placeholder="192.168.1.50"
            inputMode="decimal"
            onChange={(e) => onChange({ host: e.target.value.trim() })}
          />
        </label>
        <label className="field">
          <span>Port</span>
          <input
            className="input"
            type="number"
            value={value.port}
            onChange={(e) => onChange({ port: Number(e.target.value) || 9100 })}
          />
        </label>
        <label className="field">
          <span>Largeur du papier</span>
          <select
            className="input"
            value={value.width}
            onChange={(e) => onChange({ width: Number(e.target.value) })}
          >
            <option value={48}>80 mm (48 caractères)</option>
            <option value={32}>58 mm (32 caractères)</option>
          </select>
        </label>
      </div>

      <div className="printer-actions">
        <button type="button" className="btn btn-ghost" disabled={busy || !value.host} onClick={onTest}>
          <Icon name="printer" size={15} /> Imprimer une page de test
        </button>
        {value.mac ? (
          <span className="printer-mac" title="Numéro réseau de l'imprimante">
            <Icon name="check" size={14} /> reconnue · {value.mac}
          </span>
        ) : (
          <span className="printer-mac muted">
            Lancez une page de test pour que l'imprimante soit reconnue même si son adresse change.
          </span>
        )}
      </div>
    </section>
  );
}

export function PrintersAdmin() {
  const [config, setConfig] = useState<PrintingConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [found, setFound] = useState<FoundPrinter[] | null>(null);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    try {
      setConfig(await printingApi.config());
    } catch (e) {
      setError(fail(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!config) {
    return <p className="empty">{error ?? 'Chargement…'}</p>;
  }

  const patch = (next: Partial<PrintingConfig>) => setConfig({ ...config, ...next });

  const save = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setConfig(await printingApi.save(config));
      refreshPrintingConfig();
      setMessage('Réglages enregistrés.');
    } catch (e) {
      setError(fail(e));
    } finally {
      setBusy(false);
    }
  };

  const scan = async () => {
    setScanning(true);
    setError(null);
    setMessage(null);
    try {
      const printers = await printingApi.discover();
      setFound(printers);
      setMessage(
        printers.length
          ? `${printers.length} appareil(s) trouvé(s) sur le réseau.`
          : 'Aucune imprimante trouvée sur le réseau de ce serveur.',
      );
    } catch (e) {
      setError(fail(e));
    } finally {
      setScanning(false);
    }
  };

  // Assigning a found printer carries its network serial number along, so the
  // application can follow it if the box hands out a different address later.
  const assign = (id: PrinterId, printer: FoundPrinter) => {
    patch({
      [id]: { ...config[id], host: printer.host, port: printer.port, mac: printer.mac, enabled: true },
    } as Partial<PrintingConfig>);
    setMessage(
      `${printer.host} affectée ${id === 'kitchen' ? 'à la cuisine' : 'au comptoir'}. Enregistrez, puis imprimez une page de test.`,
    );
  };

  const assignedTo = (host: string) =>
    [config.counter.host === host && 'comptoir', config.kitchen.host === host && 'cuisine']
      .filter(Boolean)
      .join(' et ');

  // The address has to be saved before the server can print to it
  const test = async (id: PrinterId) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await printingApi.save(config);
      refreshPrintingConfig();
      await printingApi.test(id);
      setMessage(
        id === 'kitchen'
          ? 'Page de test envoyée à l’imprimante cuisine.'
          : 'Page de test envoyée à l’imprimante comptoir.',
      );
    } catch (e) {
      setError(fail(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="printers-admin">
      <div className="dash-head">
        <div>
          <h2 className="page-title">Imprimantes</h2>
          <div className="muted">
            Imprimantes thermiques du réseau : le serveur leur envoie les tickets directement,
            sans passer par le navigateur.
          </div>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="hint">{message}</div>}

      <section className="card">
        <div className="card-head">
          <h3>Rechercher les imprimantes</h3>
          <button type="button" className="btn btn-ghost" disabled={scanning} onClick={scan}>
            <Icon name="search" size={15} /> {scanning ? 'Recherche…' : 'Lancer la recherche'}
          </button>
        </div>
        <p className="muted printer-hint">
          Le serveur parcourt le réseau sur lequel il se trouve et liste tout ce qui répond aux
          imprimantes. Inutile de connaître les adresses : branchez, cherchez, affectez.
        </p>

        {found && found.length > 0 && (
          <ul className="found-list">
            {found.map((printer) => {
              const role = assignedTo(printer.host);
              return (
                <li key={`${printer.host}:${printer.port}`} className="found-item">
                  <div className="found-id">
                    <strong>{printer.host}</strong>
                    <span className="muted">{printer.mac || 'numéro réseau inconnu'}</span>
                    {role && <span className="found-role">affectée : {role}</span>}
                  </div>
                  <div className="found-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => assign('counter', printer)}
                    >
                      Comptoir
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => assign('kitchen', printer)}
                    >
                      Cuisine
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {found && found.length === 0 && (
          <p className="empty">
            Rien ne répond. Vérifiez que les imprimantes sont allumées et que leur câble réseau est
            branché, puis relancez la recherche.
          </p>
        )}
      </section>

      <div className="printer-grid">
        <PrinterCard
          title="Comptoir (caisse)"
          hint="Tickets de caisse et additions."
          value={config.counter}
          busy={busy}
          onChange={(p) => patch({ counter: { ...config.counter, ...p } })}
          onTest={() => test('counter')}
        />
        <PrinterCard
          title="Cuisine"
          hint="Bons de préparation, sans les prix."
          value={config.kitchen}
          busy={busy}
          onChange={(p) => patch({ kitchen: { ...config.kitchen, ...p } })}
          onTest={() => test('kitchen')}
        />
      </div>

      <section className="card">
        <h3>Envoi automatique</h3>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={config.autoKitchen}
            onChange={(e) => patch({ autoKitchen: e.target.checked })}
          />
          Imprimer le bon en cuisine dès qu’une commande est envoyée
        </label>
        <p className="muted printer-hint">
          Les ajouts d’articles impriment seulement les nouvelles lignes. Si l’imprimante est
          éteinte, la commande est quand même enregistrée.
        </p>
      </section>

      <section className="card">
        <h3>En-tête des tickets</h3>
        <div className="form-grid">
          <label className="field">
            <span>Nom</span>
            <input
              className="input"
              value={config.header.name}
              onChange={(e) => patch({ header: { ...config.header, name: e.target.value } })}
            />
          </label>
          <label className="field">
            <span>Sous-titre</span>
            <input
              className="input"
              value={config.header.subtitle}
              onChange={(e) => patch({ header: { ...config.header, subtitle: e.target.value } })}
            />
          </label>
          <label className="field">
            <span>Adresse</span>
            <input
              className="input"
              value={config.header.address}
              onChange={(e) => patch({ header: { ...config.header, address: e.target.value } })}
            />
          </label>
          <label className="field">
            <span>Téléphone</span>
            <input
              className="input"
              value={config.header.phone}
              onChange={(e) => patch({ header: { ...config.header, phone: e.target.value } })}
            />
          </label>
          <label className="field field-full">
            <span>Message de fin</span>
            <input
              className="input"
              value={config.header.footer}
              onChange={(e) => patch({ header: { ...config.header, footer: e.target.value } })}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
