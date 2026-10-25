import { navigate, type Route } from '../router';
import { MenuAdmin } from './admin/MenuAdmin';
import { EmployeesAdmin } from './admin/EmployeesAdmin';
import { Dashboard } from './admin/Dashboard';
import { SalesHistory } from './admin/SalesHistory';
import { PrintersAdmin } from './admin/PrintersAdmin';
import { UserMenu } from '../components/UserMenu';
import { AppBar } from '../components/AppBar';
import { Icon, type IconName } from '../components/Icon';
import { IS_ADMIN_APP, SHOW_STOCK } from '../config';

export type AdminSection = 'dashboard' | 'ventes' | 'menu' | 'employes' | 'imprimantes';

const NAV: { id: AdminSection; route: Route; label: string; icon: IconName }[] = [
  { id: 'dashboard', route: 'admin/dashboard', label: 'Tableau de bord', icon: 'chart' },
  { id: 'ventes', route: 'admin/ventes', label: 'Ventes', icon: 'list' },
  { id: 'menu', route: 'admin/menu', label: SHOW_STOCK ? 'Menu & stock' : 'Menu', icon: 'grid' },
  { id: 'employes', route: 'admin/employes', label: 'Employés', icon: 'users' },
  { id: 'imprimantes', route: 'admin/imprimantes', label: 'Imprimantes', icon: 'printer' },
];

export function AdminPage({ section }: { section: AdminSection }) {
  return (
    <div className="admin">
      <AppBar
        subtitle="Administration"
        actions={
          <>
            <UserMenu />
            {/* Pas de retour vers la caisse sur le téléphone du gérant : elle
                n'y existe pas, et le bouton ne mènerait nulle part. */}
            {!IS_ADMIN_APP && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('caisse')}>
                <Icon name="back" size={16} />
                <span className="hide-sm">Caisse</span>
              </button>
            )}
          </>
        }
      >
        <nav className="admin-nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              className={section === n.id ? 'is-active' : ''}
              onClick={() => navigate(n.route)}
              title={n.label}
            >
              <Icon name={n.icon} size={16} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
      </AppBar>

      <main className="admin-main">
        {section === 'dashboard' && <Dashboard />}
        {section === 'ventes' && <SalesHistory />}
        {section === 'menu' && <MenuAdmin />}
        {section === 'employes' && <EmployeesAdmin />}
        {section === 'imprimantes' && <PrintersAdmin />}
      </main>
    </div>
  );
}
