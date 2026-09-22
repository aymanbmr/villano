import { Icon, type IconName } from './components/Icon';

// Category icons are drawn as SVG, never as emoji: the café's older Windows
// machines have no emoji font and would show empty boxes.
export const CATEGORY_ICONS: { id: IconName; label: string }[] = [
  { id: 'cup', label: 'Boisson chaude' },
  { id: 'coffee', label: 'Café' },
  { id: 'glass', label: 'Boisson froide' },
  { id: 'bottle', label: 'Bouteille' },
  { id: 'croissant', label: 'Viennoiserie' },
  { id: 'bread', label: 'Pain' },
  { id: 'egg', label: 'Petit-déjeuner' },
  { id: 'cutlery', label: 'Plat' },
  { id: 'plate', label: 'Assiette' },
  { id: 'bowl', label: 'Soupe / tajine' },
  { id: 'pizza', label: 'Pizza' },
  { id: 'sandwich', label: 'Sandwich' },
  { id: 'fries', label: 'Frites' },
  { id: 'salad', label: 'Salade' },
  { id: 'cake', label: 'Dessert' },
  { id: 'icecream', label: 'Glace' },
  { id: 'star', label: 'Autre' },
];

const NAMES = new Set(CATEGORY_ICONS.map((i) => i.id));

// Categories created before the switch hold an emoji: map the ones the app
// shipped with, ignore anything else rather than showing a broken glyph.
const LEGACY_EMOJI: Record<string, IconName> = {
  '☕': 'cup',
  '🥤': 'glass',
  '🥐': 'croissant',
  '🍽️': 'cutlery',
  '🍽': 'cutlery',
  '🍰': 'cake',
  '🍵': 'cup',
  '🍕': 'pizza',
  '🥪': 'sandwich',
  '🍟': 'fries',
  '🥗': 'salad',
  '🍦': 'icecream',
  '🍲': 'bowl',
  '🍳': 'egg',
  '🥖': 'bread',
  '💧': 'bottle',
};

/** Stored value (icon name, legacy emoji, or nothing) -> icon to draw. */
export function categoryIconName(icon: string | null | undefined): IconName | null {
  if (!icon) return null;
  if (NAMES.has(icon as IconName)) return icon as IconName;
  return LEGACY_EMOJI[icon.trim()] ?? null;
}

export function CategoryIcon({ icon, size = 16 }: { icon: string | null | undefined; size?: number }) {
  const name = categoryIconName(icon);
  if (!name) return null;
  return <Icon name={name} size={size} className="icon category-icon" />;
}
