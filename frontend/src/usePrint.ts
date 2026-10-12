import { useCallback, useEffect, useState } from 'react';
import { printingApi, type PrintingConfig } from './api';
import type { PrintJob } from './components/PrintTicket';

// The printing setup rarely changes, so it is fetched once per session and
// refreshed when the admin saves it.
let configPromise: Promise<PrintingConfig | null> | null = null;

function loadPrintingConfig() {
  if (!configPromise) configPromise = printingApi.config().catch(() => null);
  return configPromise;
}

export function refreshPrintingConfig() {
  configPromise = null;
}

/** True when the server sends kitchen tickets to a network printer by itself. */
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
  const [job, setJob] = useState<PrintJob | null>(null);
  const [handledByServer, setHandledByServer] = useState(false);
  // Whether a kitchen slip should go out at all. The switch lives on the
  // server rather than in each browser, so the caisse, a waiter's phone and
  // the admin screen cannot disagree about it.
  const [autoKitchen, setAutoKitchenState] = useState(true);

  useEffect(() => {
    let alive = true;
    void loadPrintingConfig().then((config) => {
      if (!alive) return;
      setHandledByServer(serverPrintsKitchen(config));
      if (config) setAutoKitchenState(config.autoKitchen);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setAutoKitchen = useCallback(async (value: boolean) => {
    setAutoKitchenState(value); // l'interface répond tout de suite
    try {
      const saved = await printingApi.setAutoKitchen(value);
      refreshPrintingConfig();
      setHandledByServer(serverPrintsKitchen(saved));
    } catch {
      setAutoKitchenState(!value); // le serveur n'a pas suivi : on revient
    }
  }, []);

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    const done = () => setJob(null);
    window.addEventListener('afterprint', done);

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
      window.removeEventListener('afterprint', done);
    };
  }, [job]);

  // `server: false` for a ticket whose lines differ from the saved order (the
  // kitchen slip of an append): only the browser can render those.
  const print = useCallback(async (next: PrintJob, { server = true } = {}) => {
    if (server && next.order.id > 0 && navigator.onLine) {
      try {
        const result = await printingApi.print(next.kind, next.order.id);
        if (result.printed) return;
      } catch {
        // Printer unreachable or server down: fall back to the browser dialog
      }
    }
    setJob(next);
  }, []);

  return { job, print, serverPrintsKitchen: handledByServer, autoKitchen, setAutoKitchen };
}
