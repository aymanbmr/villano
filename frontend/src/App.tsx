import { useEffect } from 'react';
import { navigate, useRoute } from './router';
import { isAdmin, logout, useSession } from './auth';
import { IS_ADMIN_APP } from './config';
import { LoginPage } from './pages/LoginPage';
import { CaissePage } from './pages/CaissePage';
import { AdminPage } from './pages/AdminPage';

/**
 * L'application du gérant ne sert qu'à lui. Un serveur qui s'y connecte serait
 * autrement renvoyé vers la caisse, qui n'existe pas ici : il tomberait sur une
 * page vide sans comprendre. Mieux vaut le lui dire.
 */
function ReserveAuGerant() {
  return (
    <div className="login">
      <div className="login-card">
        <h1>Application du gérant</h1>
        <p className="muted">
          Ce téléphone donne accès à la carte, aux ventes et aux employés. Les commandes se
          prennent à la caisse du café.
        </p>
        <button type="button" className="btn btn-primary" onClick={logout}>
          Changer de compte
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const session = useSession();
  const gerant = isAdmin(session?.user);
  const wantsAdmin = route !== 'caisse';
  const allowed = !wantsAdmin || gerant;
  const refuse = IS_ADMIN_APP && !!session && !gerant;

  // Les caissiers qui tapent une URL d'admin sont renvoyés à la caisse.
  //
  // Rien à faire pour le cas inverse : dans l'application du gérant, la route
  // par défaut est le tableau de bord, et parse() y ramène toute adresse qu'il
  // ne reconnaît pas — « caisse » comprise, puisqu'elle n'y est pas listée.
  // La caisse n'est donc pas une page masquée là-bas : elle n'existe pas.
  useEffect(() => {
    if (!session || refuse) return;
    if (!allowed) navigate('caisse');
  }, [session, allowed, refuse]);

  if (!session) return <LoginPage />;
  if (refuse) return <ReserveAuGerant />;
  if (!allowed) return null;
  if (route === 'caisse') return <CaissePage />;
  const section =
    route === 'admin/employes'
      ? 'employes'
      : route === 'admin/menu'
        ? 'menu'
        : route === 'admin/ventes'
          ? 'ventes'
          : route === 'admin/imprimantes'
            ? 'imprimantes'
            : 'dashboard';
  return <AdminPage section={section} />;
}
