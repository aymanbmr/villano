import { useEffect, useState } from 'react';

// Tiny hash router: #/caisse, #/admin/menu, #/admin/employes
export type Route = 'caisse' | 'admin/dashboard' | 'admin/ventes' | 'admin/menu' | 'admin/employes';

const DEFAULT_ROUTE: Route = 'caisse';

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'admin' || path === 'admin/dashboard') return 'admin/dashboard';
  if (path === 'admin/ventes') return 'admin/ventes';
  if (path === 'admin/menu') return 'admin/menu';
  if (path === 'admin/employes') return 'admin/employes';
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
