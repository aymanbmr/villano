// Constructeur ESC/POS pour imprimantes thermiques 80 mm, cote caisse.
//
// Jumeau de backend/src/printing/escpos.ts, a ceci pres qu'il travaille sur des
// Uint8Array : le navigateur n'a pas de Buffer. La caisse fabrique desormais
// elle-meme les octets de ses tickets, pour les remettre a l'agent local sans
// qu'internet n'intervienne. Toute correction faite ici doit l'etre la-bas tant
// que le serveur garde sa page d'essai.
//
// Le texte est encode en CP1252 et l'imprimante basculee sur cette page de
// codes, sans quoi les accents francais sortiraient en caracteres de controle.

// CP1252 ne differe de latin1 que de 0x80 a 0x9F, ou vit la ponctuation
// typographique. Sans cette table, une apostrophe courbe s'imprimerait comme un
// caractere de controle.
const CP1252_EXTRAS: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85,
  '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a,
  '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92,
  '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c,
  'ž': 0x9e, 'Ÿ': 0x9f,
};

export function encodeCp1252(value: string): Uint8Array {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (code <= 0xff) bytes.push(code);
    else if (CP1252_EXTRAS[char] !== undefined) bytes.push(CP1252_EXTRAS[char]);
    else bytes.push(0x3f); // '?' plutot qu'un octet de controle hasardeux
  }
  return new Uint8Array(bytes);
}

const ESC = 0x1b;
const GS = 0x1d;

export class EscPos {
  private readonly chunks: Uint8Array[] = [];

  /** Caracteres par ligne : 48 sur du 80 mm, 32 sur du 58 mm. */
  constructor(private readonly width = 48) {
    this.raw([ESC, 0x40]); // init
    this.raw([ESC, 0x74, 16]); // page de codes 16 = WPC1252 (accents)
  }

  private raw(bytes: number[] | Uint8Array) {
    this.chunks.push(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    return this;
  }

  text(value: string) {
    return this.raw(encodeCp1252(value));
  }

  line(value = '') {
    return this.text(value).raw([0x0a]);
  }

  align(mode: 'left' | 'center' | 'right') {
    return this.raw([ESC, 0x61, mode === 'left' ? 0 : mode === 'center' ? 1 : 2]);
  }

  bold(on: boolean) {
    return this.raw([ESC, 0x45, on ? 1 : 0]);
  }

  /** 1 = normal, 2 = double largeur et hauteur (totaux, bons de cuisine). */
  size(scale: 1 | 2) {
    return this.raw([GS, 0x21, scale === 2 ? 0x11 : 0x00]);
  }

  rule(char = '-') {
    return this.line(char.repeat(this.width));
  }

  /** Libelle a gauche, valeur alignee a droite sur la meme ligne. */
  row(left: string, right: string) {
    const space = Math.max(1, this.width - left.length - right.length);
    return this.line(left + ' '.repeat(space) + right);
  }

  /** Ligne en double taille : deux fois moins de caracteres y tiennent. */
  bigRow(left: string, right: string) {
    const half = Math.floor(this.width / 2);
    const space = Math.max(1, half - left.length - right.length);
    this.size(2);
    this.line(left + ' '.repeat(space) + right);
    return this.size(1);
  }

  /** Replie les noms de produits trop longs au lieu de laisser l'imprimante les couper. */
  item(label: string, right: string) {
    const room = this.width - right.length - 1;
    if (label.length <= room) return this.row(label, right);
    const words = label.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > room) {
        lines.push(current.trim());
        current = word;
      } else {
        current = (current + ' ' + word).trim();
      }
    }
    lines.push(current.trim());
    this.row(lines[0], right);
    for (const extra of lines.slice(1)) this.line('  ' + extra);
    return this;
  }

  /**
   * Image en noir et blanc, par la commande raster GS v 0 — celle que toutes
   * les imprimantes ESC/POS modernes comprennent.
   *
   * `bitmap` contient des lignes de `width / 8` octets, bit de poids fort a
   * gauche, un bit a 1 valant un point noir.
   */
  image(bitmap: Uint8Array, width: number, height: number) {
    const bytesPerRow = width / 8;
    return this.raw([
      GS, 0x76, 0x30, 0x00,
      bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
      height & 0xff, (height >> 8) & 0xff,
    ]).raw(bitmap);
  }

  feed(lines = 1) {
    return this.raw([ESC, 0x64, lines]);
  }

  /** Degage le papier de la tete d'impression, puis coupe. */
  cut() {
    return this.feed(4).raw([GS, 0x56, 66, 0x00]);
  }

  build(): Uint8Array {
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}
