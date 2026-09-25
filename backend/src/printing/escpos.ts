// Minimal ESC/POS builder for 80 mm thermal printers (Xprinter and friends).
// Text is encoded in CP1252 so French accents come out right: the printer is
// switched to that code page first.

// CP1252 differs from latin1 only in 0x80–0x9F, where typographic punctuation
// lives. Without this, a curly apostrophe would print as a control character.
const CP1252_EXTRAS: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85,
  '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a,
  '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92,
  '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c,
  'ž': 0x9e, 'Ÿ': 0x9f,
};

export function encodeCp1252(value: string): Buffer {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (code <= 0xff) bytes.push(code);
    else if (CP1252_EXTRAS[char] !== undefined) bytes.push(CP1252_EXTRAS[char]);
    else bytes.push(0x3f); // '?' rather than a stray control byte
  }
  return Buffer.from(bytes);
}

const ESC = 0x1b;
const GS = 0x1d;

export class EscPos {
  private readonly chunks: Buffer[] = [];

  /** Characters per line: 48 on 80 mm paper, 32 on 58 mm. */
  constructor(private readonly width = 48) {
    this.raw([ESC, 0x40]); // init
    this.raw([ESC, 0x74, 16]); // code page 16 = WPC1252 (accents)
  }

  private raw(bytes: number[] | Buffer) {
    this.chunks.push(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes));
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

  /** 1 = normal, 2 = double width and height (big totals, table numbers). */
  size(scale: 1 | 2) {
    return this.raw([GS, 0x21, scale === 2 ? 0x11 : 0x00]);
  }

  rule(char = '-') {
    return this.line(char.repeat(this.width));
  }

  /** Label on the left, value right-aligned on the same line. */
  row(left: string, right: string) {
    const space = Math.max(1, this.width - left.length - right.length);
    return this.line(left + ' '.repeat(space) + right);
  }

  /** Row printed in double size: only half as many characters fit on the line. */
  bigRow(left: string, right: string) {
    const half = Math.floor(this.width / 2);
    const space = Math.max(1, half - left.length - right.length);
    this.size(2);
    this.line(left + ' '.repeat(space) + right);
    return this.size(1);
  }

  /** Wraps long product names instead of letting the printer cut them. */
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

  feed(lines = 1) {
    return this.raw([ESC, 0x64, lines]);
  }

  /** Feeds the paper clear of the head, then cuts. */
  cut() {
    return this.feed(4).raw([GS, 0x56, 66, 0x00]);
  }

  /** Opens the cash drawer wired to the printer, if there is one. */
  openDrawer() {
    return this.raw([ESC, 0x70, 0x00, 0x19, 0xfa]);
  }

  build() {
    return Buffer.concat(this.chunks);
  }
}
