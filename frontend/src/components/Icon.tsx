import type { SVGProps } from 'react';

// Small inline icon set (Feather-style, 24x24 stroke paths) so the UI chrome
// doesn't depend on emoji rendering. Category icons chosen by the user stay emoji.
const PATHS = {
  search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  cart: <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>,
  receipt: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
  clipboard: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></>,
  printer: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  settings: <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
  back: <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  edit: <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 21.5 2 23l1.5-5.5L17 3z" />,
  coffee: <><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  card: <><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><line x1="6" y1="12" x2="6" y2="12.01" /><line x1="18" y1="12" x2="18" y2="12.01" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>,
  note: <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>,
  keypad: <><circle cx="6" cy="6" r="1.5" /><circle cx="12" cy="6" r="1.5" /><circle cx="18" cy="6" r="1.5" /><circle cx="6" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="18" cy="12" r="1.5" /><circle cx="6" cy="18" r="1.5" /><circle cx="12" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></>,
  chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  list: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
  alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  // --- Catégories du menu (dessins simples : aucune police emoji requise,
  // les anciennes caisses Windows 7 ne les affichent pas) ---
  cup: <><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /></>,
  glass: <><path d="M6 3h12l-1.5 17a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2L6 3z" /><line x1="6.5" y1="9" x2="17.5" y2="9" /><line x1="15" y1="3" x2="12" y2="14" /></>,
  bottle: <><path d="M10 2h4v3a4 4 0 0 0 1.2 2.8l.6.6A4 4 0 0 1 17 11.2V20a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8.8a4 4 0 0 1 1.2-2.8l.6-.6A4 4 0 0 0 10 5V2z" /><line x1="7" y1="13" x2="17" y2="13" /></>,
  croissant: <><path d="M3 17a12 12 0 0 1 18-10" /><path d="M3 17c4 3 12 3 18-10" /><line x1="9" y1="9" x2="11" y2="14" /><line x1="14" y1="7" x2="15" y2="12" /></>,
  bread: <><rect x="3" y="7" width="18" height="12" rx="4" /><line x1="8" y1="10" x2="10" y2="16" /><line x1="13" y1="10" x2="15" y2="16" /></>,
  egg: <><ellipse cx="12" cy="13" rx="8" ry="7" /><circle cx="12" cy="13" r="3" /></>,
  plate: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></>,
  cutlery: <><path d="M6 2v8a2 2 0 0 0 2 2v10" /><path d="M4 2v5" /><path d="M8 2v5" /><path d="M18 2c-2 2-3 4-3 7s1 4 3 4v9" /></>,
  pizza: <><path d="M12 3 3 20c6 2 12 2 18 0L12 3z" /><circle cx="10" cy="13" r="1" /><circle cx="14" cy="16" r="1" /></>,
  sandwich: <><path d="M3 9l9-5 9 5" /><rect x="3" y="9" width="18" height="4" rx="2" /><path d="M3 15h18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" /></>,
  fries: <><path d="M7 10h10l-1 10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2L7 10z" /><line x1="9" y1="10" x2="9" y2="3" /><line x1="12" y1="10" x2="12" y2="2" /><line x1="15" y1="10" x2="15" y2="4" /></>,
  cake: <><path d="M4 21h16v-7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v7z" /><path d="M4 16c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2" /><line x1="12" y1="4" x2="12" y2="8" /></>,
  icecream: <><path d="M8 10a4 4 0 0 1 8 0" /><path d="M7 10h10l-4.2 10.6a1 1 0 0 1-1.6 0L7 10z" /></>,
  bowl: <><path d="M3 12h18a9 9 0 0 1-18 0z" /><path d="M9 8c0-2 1-3 1-4" /><path d="M14 8c0-2 1-3 1-4" /></>,
  leaf: <><path d="M4 20c0-8 5-14 16-15 1 10-4 16-12 16a6 6 0 0 1-4-1z" /><line x1="8" y1="20" x2="16" y2="10" /></>,
  salad: <><path d="M3 12h18a9 9 0 0 1-18 0z" /><path d="M7 9a3 3 0 0 1 4-3 3 3 0 0 1 5-1 3 3 0 0 1 2 4" /></>,
  star: <polygon points="12 3 14.8 9.2 21.5 10 16.6 14.5 18 21 12 17.7 6 21 7.4 14.5 2.5 10 9.2 9.2" />,
  up: <polyline points="6 15 12 9 18 15" />,
  down: <polyline points="6 9 12 15 18 9" />,
  arrowRight: <><line x1="4" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" /></>,
  backspace: <><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /><line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" /></>,
} as const;

export type IconName = keyof typeof PATHS;

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="icon"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
