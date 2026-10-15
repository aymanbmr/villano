#!/usr/bin/env node
// Relais d'impression Villano : à lancer au café, sur une machine branchée au
// même réseau que les imprimantes. Interroge le serveur (qui, hébergé ailleurs,
// ne peut pas joindre les imprimantes lui-même), récupère les tickets en
// attente et les envoie directement, en ESC/POS brut, comme le ferait le
// serveur s'il était sur place.
//
// Aucune dépendance : Node 18+ suffit (fetch et net sont intégrés).
//
//   SERVER_URL=https://mon-serveur.example RELAY_TOKEN=xxxx node relay.js
//
// Ou avec un fichier relay.env à côté de ce script (voir relay.env.example).

import { Socket } from 'node:net';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Charge relay.env s'il existe, sans écraser des variables déjà présentes
// dans l'environnement (utile pour lancer plusieurs fois avec des réglages
// différents sans toucher au fichier).
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvFile(join(here, 'relay.env'));

const SERVER_URL = (process.env.SERVER_URL ?? '').replace(/\/+$/, '');
const RELAY_TOKEN = process.env.RELAY_TOKEN ?? '';
const POLL_MS = Number(process.env.POLL_INTERVAL_MS ?? 3000);

if (!SERVER_URL || !RELAY_TOKEN) {
  console.error('SERVER_URL et RELAY_TOKEN sont obligatoires (variables d’environnement ou relay.env).');
  process.exit(1);
}

function log(message) {
  console.log(`[${new Date().toLocaleTimeString('fr-FR')}] ${message}`);
}

// Envoie les octets ESC/POS directement à l'imprimante réseau, sur le port
// qu'elle écoute (9100, le standard "RAW/JetDirect" de toutes les imprimantes
// ticket réseau).
function sendToPrinter(host, port, buffer, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const fail = (message) => {
      socket.destroy();
      reject(new Error(message));
    };
    socket.setTimeout(timeoutMs);
    socket.once('timeout', () => fail(`${host}:${port} ne répond pas`));
    socket.once('error', (e) => fail(`${host}:${port} injoignable : ${e.message}`));
    socket.connect(port, host, () => {
      socket.end(buffer, () => {
        socket.destroy();
        resolve();
      });
    });
  });
}

// Le serveur garde la ligne ouverte s'il n'a rien a imprimer : le ticket part
// des qu'il est pret plutot qu'au prochain passage.
const WAIT_SECONDS = 20;

async function fetchJobs() {
  const res = await fetch(`${SERVER_URL}/api/printing/relay/jobs?wait=${WAIT_SECONDS}`, {
    headers: { 'X-Relay-Token': RELAY_TOKEN },
    signal: AbortSignal.timeout((WAIT_SECONDS + 15) * 1000),
  });
  if (!res.ok) throw new Error(`Le serveur a répondu ${res.status}`);
  return res.json();
}

async function acknowledge(id) {
  const res = await fetch(`${SERVER_URL}/api/printing/relay/jobs/${id}`, {
    method: 'DELETE',
    headers: { 'X-Relay-Token': RELAY_TOKEN },
  });
  if (!res.ok) throw new Error(`Confirmation refusée (${res.status})`);
}

async function tick() {
  let jobs;
  try {
    jobs = await fetchJobs();
  } catch (e) {
    log(`Serveur injoignable : ${e.message}`);
    return;
  }

  for (const job of jobs) {
    try {
      const buffer = Buffer.from(job.payload, 'base64');
      await sendToPrinter(job.host, job.port, buffer);
      await acknowledge(job.id);
      log(`Ticket #${job.id} imprimé (${job.printerId} · ${job.host}:${job.port})`);
    } catch (e) {
      // L'imprimante est peut-être juste éteinte : on retente au prochain
      // passage plutôt que de perdre le ticket.
      log(`Ticket #${job.id} en attente : ${e.message}`);
    }
  }
}

log(`Relais démarré — serveur ${SERVER_URL}, vérification toutes les ${POLL_MS / 1000}s.`);
void tick();
setInterval(() => void tick(), POLL_MS);
