// Date-range presets shared by the dashboard and the sales history

export const toDayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom';

export const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'yesterday', label: 'Hier' },
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: 'month', label: 'Ce mois' },
];

export function presetRange(p: Preset): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  const to = new Date(today);
  switch (p) {
    case 'yesterday':
      from.setDate(from.getDate() - 1);
      to.setDate(to.getDate() - 1);
      break;
    case '7d':
      from.setDate(from.getDate() - 6);
      break;
    case '30d':
      from.setDate(from.getDate() - 29);
      break;
    case 'month':
      from.setDate(1);
      break;
  }
  return { from: toDayKey(from), to: toDayKey(to) };
}

// "2026-09-21" -> "21/09"
export const shortDay = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

export const fullDay = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
