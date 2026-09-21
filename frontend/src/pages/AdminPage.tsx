import { navigate, type Route } from '../router';
import { MenuAdmin } from './admin/MenuAdmin';
import { EmployeesAdmin } from './admin/EmployeesAdmin';
import { Dashboard } from './admin/Dashboard';
import { SalesHistory } from './admin/SalesHistory';
import { UserMenu } from '../components/UserMenu';
import { AppBar } from '../components/AppBar';
import { Icon, type IconName } from '../components/Icon';

export type AdminSection = 'dashboard' | 'ventes' | 'menu' | 'employes';

const NAV: { id: AdminSection; route: Route; label: string; icon: IconName }[] = [
  { id: 'dashboard', route: 'admin/dashboard', label: 'Tableau de bord', icon: 'chart' },
  { id: 'ventes', route: 'admin/ventes', label: 'Ventes', icon: 'list' },
  { id: 'menu', route: 'admin/menu', label: 'Menu & stock', icon: 'grid' },
  { id: 'employes', route: 'admin/employes', label: 'Employés', icon: 'users' },
];

export function AdminPage({ section }: { section: AdminSection }) {
  return (
    <div className="admin">
      <AppBar
        subtitle="Administration"
        actions={
          <>
            <UserMenu />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('caisse')}>
              <Icon name="back" size={16} />
              <span className="hide-sm">Caisse</span>
            </button>
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
      </main>
    </div>
  );
}
