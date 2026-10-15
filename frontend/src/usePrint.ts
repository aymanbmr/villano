import { useCallback, useEffect, useRef, useState } from 'react';
import { printingApi, type PrintingConfig } from './api';
import type { PrintJob } from './components/PrintTicket';

// The printing setup rarely changes, so it is fetched once per session and
// refreshed when the admin saves it.
let configPromise: Promise<PrintingConfig | null> | null = null;

function loadPrintingConfig() {
  if (!configPromise) {
    configPromise = printingApi.config().catch(() => {
      // Un échec ne doit pas être retenu : la prochaine impression réessaiera,
      // sans quoi une seule tentative ratée condamnerait toute la session.
      configPromise = null;
      return null;
    });
  }
  return configPromise;
}

export function refreshPrintingConfig() {
  configPromise = null;
}

/** Au-delà, on considère que le serveur n'imprimera pas et on bascule. */
const SERVER_PRINT_TIMEOUT = 2500;

/** True when the server sends kitchen tickets to a network printer by itself. */
/**
 * Le serveur a-t-il seulement une imprimante a qui parler ? Si non, inutile de
 * lui demander d'imprimer : il repondrait non apres un aller-retour complet,
 * et le navigateur prendrait le relais de toute facon. Sur un serveur
 * lointain, cela retardait chaque ticket d'un quart de seconde pour rien.
 */
function serveurPeutImprimer(config: PrintingConfig | null) {
  if (!config) return false;
  const branchee = (p: { enabled: boolean; host: string }) => p.enabled && !!p.host;
  return branchee(config.counter) || branchee(config.kitchen);
}

function serverPrintsKitchen(config: PrintingConfig | null) {
  return !!config && config.autoKitchen && config.kitchen.enabled && !!config.kitchen.host;
}

// Waits for every image of the ticket to be ready (never longer than a
// second, so a missing image can never block an order).
async function waitForImages() {
  const images = [...document.querySelectorAll<HTMLImageElement>('.ticket-print img')];
  await Promise.race([
    Promise.all(
      images.map((img) =>
        img.complete ? Promise.resolve() : img.decode().catch(() => undefined),
      ),
    ),
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ]);
}

// Prints a ticket. A network printer configured in the admin is driven by the
// server, so nothing appears on screen; otherwise the ticket is rendered into
// the page and the browser print dialog opens, then it is cleared. Only the
// ticket is visible under @media print (index.css).
export function usePrint() {
  // Une file, et non un seul ticket : un encaissement en produit deux, le bon
  // de cuisine puis celui du client. Avec une seule place, le second effaçait
  // le premier avant qu'il n'ait eu le temps de sortir — et le bon de cuisine
  // se perdait sans que rien ne le signale.
  const [queue, setQueue] = useState<PrintJob[]>([]);
  const job = queue[0] ?? null;
  const [handledByServer, setHandledByServer] = useState(false);
  // Lu dans print() par reference, pour ne pas recreer la fonction a chaque
  // changement d'etat.
  const serveurImprimeRef = useRef(false);
  const [browserFallback, setBrowserFallback] = useState(false);
  // Whether a kitchen slip should go out at all. The switch lives on the
  // server rather than in each browser, so the caisse, a waiter's phone and
  // the admin screen cannot disagree about it.
  const [autoKitchen, setAutoKitchenState] = useState(true);

  useEffect(() => {
    let alive = true;
    void loadPrintingConfig().then((config) => {
      if (!alive) return;
      setHandledByServer(serverPrintsKitchen(config));
      serveurImprimeRef.current = serveurPeutImprimer(config);
      if (config) {
        setAutoKitchenState(config.autoKitchen);
        setBrowserFallback(config.browserFallback === true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // Lu dans print() sans le faire dependre de l'etat, qui recreerait la
  // fonction a chaque changement.
  const browserFallbackRef = useRef(false);
  browserFallbackRef.current = browserFallback;

  const setAutoKitchen = useCallback(async (value: boolean) => {
    setAutoKitchenState(value); // l'interface répond tout de suite
    try {
      const saved = await printingApi.setAutoKitchen(value);
      refreshPrintingConfig();
      setHandledByServer(serverPrintsKitchen(saved));
      serveurImprimeRef.current = serveurPeutImprimer(saved);
    } catch {
      setAutoKitchenState(!value); // le serveur n'a pas suivi : on revient
    }
  }, []);

  // Ne dépend que du ticket en tête : en ajouter un autre pendant l'impression
  // ne doit pas relancer celle qui est en cours.
  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    const suivant = () => setQueue((q) => q.slice(1));
    window.addEventListener('afterprint', suivant, { once: true });
    // Filet : « afterprint » ne se déclenche pas partout, notamment avec
    // --kiosk-printing selon les versions. Sans cela la file resterait bloquée.
    const filet = setTimeout(suivant, 4000);

    // Print only once the ticket is in the DOM *and* its images are decoded:
    // printing too early produces a ticket without the logo.
    const run = async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await waitForImages();
      if (!cancelled) window.print();
    };
    void run();

    return () => {
      cancelled = true;
      clearTimeout(filet);
      window.removeEventListener('afterprint', suivant);
    };
  }, [job]);

  // `server: false` for a ticket whose lines differ from the saved order (the
  // kitchen slip of an append): only the browser can render those.
  /**
   * `auto` distingue le ticket qui part de lui-meme a l'encaissement du ticket
   * demande d'un clic. La boite d'impression du navigateur est modale : elle
   * fige la caisse tant qu'on ne l'a pas fermee, ce qui est tenable quand on
   * l'a demandee, et ruineux a chaque vente. Un ticket automatique que le
   * serveur n'a pas pu imprimer est donc signale, pas affiche.
   */
  const print = useCallback(async (next: PrintJob, { server = true, auto = false } = {}) => {
    if (server && serveurImprimeRef.current && next.order.id > 0 && navigator.onLine) {
      try {
        // Un serveur hébergé ne peut pas joindre une imprimante du café : il
        // sonderait l'adresse, balaierait son réseau puis expirerait, soit une
        // dizaine de secondes avant que le navigateur ne prenne le relais. On
        // ne lui laisse que le temps d'une imprimante réellement joignable.
        const result = await Promise.race([
          printingApi.print(next.kind, next.order.id),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), SERVER_PRINT_TIMEOUT)),
        ]);
        if (result?.printed) return true;
      } catch {
        // Imprimante injoignable ou serveur muet : le navigateur prend la main
      }
    }
    // Un ticket automatique ne passe par le navigateur que si le cafe l'a
    // demande : sans --kiosk-printing, la fenetre figerait la caisse.
    if (auto && !browserFallbackRef.current) return false;
    // Le ticket du navigateur reprend le Wi-Fi des reglages du serveur, pour
    // ne pas dire autre chose que celui de l'imprimante reseau.
    const config = await loadPrintingConfig();
    setQueue((q) => [
      ...q,
      { ...next, wifi: { name: config?.header.wifiName, password: config?.header.wifiPassword } },
    ]);
    return true;
  }, []);

  return { job, print, serverPrintsKitchen: handledByServer, autoKitchen, setAutoKitchen };
}
