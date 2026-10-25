import { useCallback, useEffect, useRef, useState } from 'react';
import { printingApi, type PrintingConfig } from './api';
import type { PrintJob } from './components/PrintTicket';
import { agentPresent, imprimerParAgent, oublierPresence } from './printing/agent';
import { printerFor, renderTicket } from './printing/ticket';

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
  // L'agent a peut-etre ete demarre entre-temps : on redemande plutot que de
  // rester sur un constat d'absence qui enverrait les tickets au navigateur.
  oublierPresence();
}

/** Une imprimante est-elle renseignee, quel que soit le ticket ? */
function imprimanteRenseignee(config: PrintingConfig | null) {
  if (!config) return false;
  return !!printerFor('receipt', config) || !!printerFor('kitchen', config);
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

// Le bon de bar n'a pas d'imprimante a lui : il part du comptoir.
function serverPrintsBarman(config: PrintingConfig | null) {
  return !!config && config.autoKitchen && config.counter.enabled && !!config.counter.host;
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

  const [handledByServer, setHandledByServer] = useState(false);
  const [handledByServerBarman, setHandledByServerBarman] = useState(false);
  // Lu dans print() par reference, pour ne pas recreer la fonction a chaque
  // changement d'etat.
  const serveurImprimeRef = useRef(false);
  // Le serveur a-t-il deja montre qu'il n'atteignait pas l'imprimante ?
  const serveurAEchoueRef = useRef(false);
  const [browserFallback, setBrowserFallback] = useState(false);
  // Whether a kitchen slip should go out at all. The switch lives on the
  // server rather than in each browser, so the caisse, a waiter's phone and
  // the admin screen cannot disagree about it.
  const [autoKitchen, setAutoKitchenState] = useState(true);

  useEffect(() => {
    let alive = true;
    void loadPrintingConfig().then(async (config) => {
      if (!alive) return;
      if (config) {
        setAutoKitchenState(config.autoKitchen);
        setBrowserFallback(config.browserFallback === true);
      }
      // Quand l'agent local repond, il imprime tout : le serveur sort de la
      // boucle, et la caisse se charge elle-meme du bon de cuisine. C'est ce
      // qui rend l'impression insensible a la connexion, puisque plus rien ne
      // quitte le cafe.
      const agent = imprimanteRenseignee(config) && (await agentPresent());
      if (!alive) return;
      setHandledByServer(!agent && serverPrintsKitchen(config));
      setHandledByServerBarman(!agent && serverPrintsBarman(config));
      serveurImprimeRef.current = !agent && serveurPeutImprimer(config);
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
      setHandledByServerBarman(serverPrintsBarman(saved));
      serveurImprimeRef.current = serveurPeutImprimer(saved);
    } catch {
      setAutoKitchenState(!value); // le serveur n'a pas suivi : on revient
    }
  }, []);

  // Tous les tickets en attente partent d'un seul envoi, separes par un saut
  // de page. Les imprimer l'un apres l'autre obligeait a attendre la fin du
  // precedent, or Chrome en mode kiosque ne signale pas toujours cette fin :
  // le second ticket sortait alors plusieurs secondes plus tard.
  useEffect(() => {
    if (queue.length === 0) return;
    let cancelled = false;
    let retrait: ReturnType<typeof setTimeout> | undefined;
    // Combien de tickets cet envoi couvre : ceux-la seuls seront retires, un
    // encaissement suivant ne doit pas disparaitre avec eux.
    const envoyes = queue.length;
    // Court repit : les deux tickets d'un encaissement sont demandes coup sur
    // coup, autant les reunir dans la meme impression.
    const timer = setTimeout(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await waitForImages();
      if (cancelled) return;
      window.print();
      // En mode kiosque, window.print() rend la main sans que la page soit
      // forcement deja rendue pour l'imprimante. Retirer le ticket du DOM dans
      // la foulee pouvait donc n'envoyer qu'une page blanche. On le laisse en
      // place le temps que l'impression soit constituee ; il reste invisible a
      // l'ecran de toute facon.
      retrait = setTimeout(() => setQueue((q) => q.slice(envoyes)), 2000);
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(retrait);
    };
  }, [queue]);

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
    const config = await loadPrintingConfig();

    // 1. L'agent local, le chemin normal au cafe. La caisse fabrique les octets
    // du ticket et les remet a l'agent, sur la meme machine : il n'y a donc
    // aucune difference entre « avec connexion » et « sans », et chaque ticket
    // part sur SON imprimante -- ce qu'un navigateur, limite a une seule
    // destination, ne saurait pas faire.
    if (config) {
      const imprimante = printerFor(next.kind, config);
      if (imprimante && (await agentPresent())) {
        const octets = renderTicket(next.kind, next.order, config, imprimante);
        const sorti = await imprimerParAgent({
          host: imprimante.host,
          port: imprimante.port,
          payload: octets,
        });
        if (sorti) return true;
        // L'agent est la mais l'imprimante a refuse : inutile d'aller demander
        // au serveur de joindre la meme imprimante, il echouerait pareil.
        if (auto && !browserFallbackRef.current) return false;
      }
    }

    // 2. Le serveur, quand il peut joindre une imprimante lui-meme.
    //
    // Un serveur heberge n'atteindra jamais une 192.168.x.x du cafe. Son echec
    // coute pourtant l'attente complete, et le payer a chaque vente faisait
    // exactement le delai qu'on cherche a supprimer. On ne l'essaie donc
    // qu'une fois : le premier echec le retire du chemin pour la session.
    if (
      server &&
      serveurImprimeRef.current &&
      !serveurAEchoueRef.current &&
      next.order.id > 0 &&
      navigator.onLine
    ) {
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
        serveurAEchoueRef.current = true;
      } catch {
        // Imprimante injoignable ou serveur muet : le navigateur prend la main
        serveurAEchoueRef.current = true;
      }
    }
    // 3. Le navigateur, en dernier recours. Un ticket automatique n'y passe que
    // si le cafe l'a demande : sans --kiosk-printing, la fenetre figerait la
    // caisse a chaque vente.
    if (auto && !browserFallbackRef.current) return false;
    // Le ticket du navigateur reprend le Wi-Fi des reglages du serveur, pour
    // ne pas dire autre chose que celui de l'imprimante reseau.
    setQueue((q) => [
      ...q,
      { ...next, wifi: { name: config?.header.wifiName, password: config?.header.wifiPassword } },
    ]);
    return true;
  }, []);

  return {
    jobs: queue,
    print,
    serverPrintsKitchen: handledByServer,
    serverPrintsBarman: handledByServerBarman,
    autoKitchen,
    setAutoKitchen,
  };
}
