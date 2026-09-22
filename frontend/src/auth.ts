import { useEffect, useState } from 'react';

export type AppRole =
  | 'admin'
  | 'manager'
  | 'serveur'
  | 'caissier'
  | 'barman'
  | 'cuisinier'
  | 'menage';

export interface AuthUser {
  id: number;
  name: string;
  role: AppRole;
}

export interface Session {
  token: string;
  user: AuthUser;
}

const STORAGE_KEY = 'villano.session';
const listeners = new Set<() => void>();
let current: Session | null = read();

function read(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function notify() {
  for (const l of listeners) l();
}

export function getSession() {
  return current;
}

export function setSession(session: Session | null) {
  current = session;
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // private mode: session lives in memory only
  }
  notify();
}

export const logout = () => setSession(null);

export const isAdmin = (user: AuthUser | null | undefined) =>
  user?.role === 'admin' || user?.role === 'manager';

// Opening and closing the caisse day is reserved to the cashier, the manager
// and the owner — a waiter or barman only takes orders (same rule server-side).
export const canManageWorkDay = (user: AuthUser | null | undefined) =>
  isAdmin(user) || user?.role === 'caissier';

// React binding: re-renders when the session changes (login, logout, 401)
export function useSession() {
  const [session, set] = useState(current);
  useEffect(() => {
    const l = () => set(current);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return session;
}
