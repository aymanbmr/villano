import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { RESTAURANT } from '../config';

interface Props {
  // Middle slot: navigation tabs (admin) or search (caisse)
  children?: ReactNode;
  // Right slot: user menu, actions
  actions?: ReactNode;
  subtitle?: string;
}

// Dark top bar shared by the caisse and the admin pages
export function AppBar({ children, actions, subtitle }: Props) {
  return (
    <header className="appbar">
      <div className="appbar-brand">
        <span className="appbar-logo">
          <Icon name="coffee" size={18} />
        </span>
        <span className="appbar-name">{RESTAURANT.name}</span>
        {subtitle && <span className="appbar-subtitle">{subtitle}</span>}
      </div>
      <div className="appbar-center">{children}</div>
      <div className="appbar-actions">{actions}</div>
    </header>
  );
}
