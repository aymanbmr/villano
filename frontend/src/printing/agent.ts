// Dialogue avec l'agent d'impression installe sur la caisse (relay/Villano-imprimante.ps1).
//
// Pourquoi un agent : un navigateur ne sait pas ouvrir une connexion TCP vers
// le port 9100 d'une imprimante, et Chrome n'a qu'une seule destination
// d'impression -- le bon de cuisine sortirait donc au comptoir. L'agent tourne
// sur la caisse, recoit les octets deja prepares et les pousse vers la bonne
// adresse. Rien ne sort du cafe, donc rien ne depend d'internet.

const AGENT = 'http://127.0.0.1:9631';

/** Au-dela, on considere que l'agent n'est pas la et on bascule. */
const DELAI_IMPRESSION = 4000;
const DELAI_PRESENCE = 700;

/** Duree de validite du dernier constat de presence. */
const MEMOIRE_PRESENCE = 20_000;

let presence: { a: number; la: boolean } | null = null;

function base64(bytes: Uint8Array): string {
  // btoa prend une chaine : on la construit par tranches, un apply sur
  // plusieurs dizaines de milliers d'octets faisant deborder la pile.
  let texte = '';
  const tranche = 8192;
  for (let i = 0; i < bytes.length; i += tranche) {
    texte += String.fromCharCode(...bytes.subarray(i, i + tranche));
  }
  return btoa(texte);
}

async function appel(chemin: string, init: RequestInit, delai: number) {
  const stop = new AbortController();
  const minuteur = setTimeout(() => stop.abort(), delai);
  try {
    return await fetch(AGENT + chemin, { ...init, signal: stop.signal });
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * L'agent repond-il ? Le resultat est garde quelques secondes : sans cela,
 * chaque ticket paierait une tentative de connexion quand l'agent est absent.
 * Mais il n'est pas garde indefiniment, pour que demarrer l'agent en cours de
 * service suffise a le faire reprendre la main.
 */
export async function agentPresent(): Promise<boolean> {
  if (presence && Date.now() - presence.a < MEMOIRE_PRESENCE) return presence.la;
  let la = false;
  try {
    const r = await appel('/ping', { method: 'GET' }, DELAI_PRESENCE);
    la = r.ok;
  } catch {
    la = false;
  }
  presence = { a: Date.now(), la };
  return la;
}

/** A appeler quand les reglages changent, pour ne pas rester sur un vieux constat. */
export function oublierPresence() {
  presence = null;
}

export interface EnvoiAgent {
  host: string;
  port: number;
  payload: Uint8Array;
}

/**
 * Pousse un ticket vers l'agent. Rend true seulement si l'imprimante l'a
 * accepte : un echec doit laisser la caisse essayer autre chose plutot que de
 * faire croire a un ticket sorti.
 *
 * Le corps part en text/plain : c'est une requete « simple » au sens CORS, donc
 * sans preflight, ce qui epargne un aller-retour a chaque ticket.
 */
export async function imprimerParAgent({ host, port, payload }: EnvoiAgent): Promise<boolean> {
  try {
    const r = await appel(
      '/print',
      {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ host, port, payload: base64(payload) }),
      },
      DELAI_IMPRESSION,
    );
    if (!r.ok) {
      presence = { a: Date.now(), la: true }; // l'agent est la, c'est l'imprimante qui a refuse
      return false;
    }
    const reponse = (await r.json()) as { printed?: boolean };
    presence = { a: Date.now(), la: true };
    return reponse.printed === true;
  } catch {
    presence = { a: Date.now(), la: false };
    return false;
  }
}
