// Imprimante thermique simulée, pour développer sans matériel.
//
//   cd backend && npm run fake:printer
//
// Elle écoute sur le port 9100 comme une vraie imprimante réseau, et affiche
// dans le terminal ce qu'elle reçoit, avec les commandes ESC/POS traduites.
// Renseignez ensuite 127.0.0.1 dans Admin → Imprimantes : les tickets partent
// alors tout seuls, sans que le navigateur n'ouvre quoi que ce soit — ce qui
// est exactement ce qui se passera au café avec une vraie imprimante.
import { createServer } from 'node:net';

const PORT = Number(process.env.FAKE_PRINTER_PORT ?? 9100);

/** Rend lisible un flux ESC/POS : le texte tel quel, les commandes nommées. */
function decode(buffer: Buffer): string {
  const out: string[] = [];
  let text = '';
  const flush = () => {
    if (text) {
      out.push(text);
      text = '';
    }
  };

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];

    if (byte === 0x1b) {
      const next = buffer[i + 1];
      if (next === 0x40) { flush(); out.push('[INIT]'); i += 1; continue; }
      if (next === 0x74) { flush(); i += 2; continue; } // page de codes
      if (next === 0x61) { flush(); i += 2; continue; } // alignement
      if (next === 0x45) { flush(); i += 2; continue; } // gras
      if (next === 0x64) { flush(); out.push('[AVANCE PAPIER]'); i += 2; continue; }
    }
    if (byte === 0x1d) {
      const next = buffer[i + 1];
      if (next === 0x21) { flush(); i += 2; continue; } // taille
      if (next === 0x56) { flush(); out.push('[COUPE]'); i += 3; continue; }
      // Image raster : on annonce ses dimensions et on saute ses octets
      if (next === 0x76 && buffer[i + 2] === 0x30) {
        flush();
        const octetsParLigne = buffer[i + 4] | (buffer[i + 5] << 8);
        const hauteur = buffer[i + 6] | (buffer[i + 7] << 8);
        out.push(`[IMAGE ${octetsParLigne * 8}x${hauteur}]`);
        i += 8 + octetsParLigne * hauteur - 1;
        continue;
      }
    }
    if (byte === 0x0a) { flush(); out.push('\n'); continue; }

    // Le flux est en CP1252, dont latin1 restitue l'essentiel à l'écran
    text += Buffer.from([byte]).toString('latin1');
  }

  flush();
  return out.join('');
}

let count = 0;

createServer((socket) => {
  const chunks: Buffer[] = [];
  socket.on('data', (chunk) => chunks.push(chunk));
  socket.on('close', () => {
    const payload = Buffer.concat(chunks);
    if (payload.length === 0) return; // simple test de connexion
    count += 1;
    console.log(`\n┌─ ticket ${count} ─ ${payload.length} octets ─────────────────`);
    console.log(decode(payload));
    console.log('└────────────────────────────────────────────\n');
  });
  socket.on('error', () => undefined);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Imprimante simulée en écoute sur le port ${PORT}.`);
  console.log('Dans Admin → Imprimantes, mettez 127.0.0.1 et ce port, puis');
  console.log('cochez « Activée » et enregistrez. Ctrl+C pour arrêter.');
});
