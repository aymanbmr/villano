// Placeholder product images, drawn as plain SVG shapes and initials.
// No emoji anywhere: the café's older Windows machines have no emoji font and
// would render empty boxes instead.

const PALETTES: [string, string][] = [
  ['#6f4e37', '#c69c6d'],
  ['#0f766e', '#5eead4'],
  ['#b45309', '#fcd34d'],
  ['#9f1239', '#fb7185'],
  ['#7e22ce', '#f0abfc'],
  ['#1d4ed8', '#93c5fd'],
];

export function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** One or two letters taken from the product name, e.g. "Café crème" -> "CC". */
function initials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function placeholderSvg(name: string, paletteSeed: number) {
  const [from, to] = PALETTES[Math.abs(paletteSeed) % PALETTES.length];
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450">',
    '  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
    `    <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>`,
    '  </linearGradient></defs>',
    '  <rect width="600" height="450" fill="url(#g)"/>',
    '  <circle cx="300" cy="195" r="105" fill="rgba(255,255,255,0.18)"/>',
    `  <text x="300" y="235" font-family="Arial, Helvetica, sans-serif" font-size="110" font-weight="700" fill="#fff" text-anchor="middle">${escapeXml(initials(name))}</text>`,
    `  <text x="300" y="380" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#fff" text-anchor="middle">${escapeXml(name)}</text>`,
    '</svg>',
  ].join('\n');
}
