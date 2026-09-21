import { useEffect } from 'react';
import { navigate, useRoute } from './router';
import { isAdmin, useSession } from './auth';
import { LoginPage } from './pages/LoginPage';
import { CaissePage } from './pages/CaissePage';
import { AdminPage } from './pages/AdminPage';

export default function App() {
  const route = useRoute();
  const session = useSession();
  const wantsAdmin = route !== 'caisse';
  const allowed = !wantsAdmin || isAdmin(session?.user);

  // Cashiers who type an admin URL are sent back to the caisse
  useEffect(() => {
    if (session && !allowed) navigate('caisse');
  }, [session, allowed]);

  if (!session) return <LoginPage />;
  if (!allowed) return null;
  if (route === 'caisse') return <CaissePage />;
  const section = route === 'admin/employes' ? 'employes' : route === 'admin/menu' ? 'menu' : route === 'admin/ventes' ? 'ventes' : 'dashboard';
  return <AdminPage section={section} />;
}
