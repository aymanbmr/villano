import { useEffect, useState } from 'react';
import { IS_ADMIN_APP } from './config';

// Tiny hash router: #/caisse, #/admin/menu, #/admin/employes
export type Route =
  | 'caisse'
  | 'admin/dashboard'
  | 'admin/ventes'
  | 'admin/menu'
  | 'admin/employes'
  | 'admin/imprimantes';

// Sur le téléphone du gérant, l'application s'ouvre sur l'administration : la
// caisse n'y est pas une page qu'on visite, c'est une page qui n'existe pas.
const DEFAULT_ROUTE: Route = IS_ADMIN_APP ? 'admin/dashboard' : 'caisse';

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'admin' || path === 'admin/dashboard') return 'admin/dashboard';
  if (path === 'admin/ventes') return 'admin/ventes';
  if (path === 'admin/menu') return 'admin/menu';
  if (path === 'admin/employes') return 'admin/employes';
  if (path === 'admin/imprimantes') return 'admin/imprimantes';
  return DEFAULT_ROUTE;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(route: Route) {
  window.location.hash = '#/' + route;
}
