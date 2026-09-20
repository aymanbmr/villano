import { navigate } from '../router';
import { MenuAdmin } from './admin/MenuAdmin';
import { EmployeesAdmin } from './admin/EmployeesAdmin';
import { UserMenu } from '../components/UserMenu';

export type AdminSection = 'menu' | 'employes';

export function AdminPage({ section }: { section: AdminSection }) {
  return (
    <div className="admin">
      <header className="admin-header">
        <div className="admin-brand">
          <span className="brand">Villano</span>
          <span className="admin-tag">Administration</span>
        </div>
        <nav className="admin-nav">
          <button
            type="button"
            className={section === 'menu' ? 'is-active' : ''}
            onClick={() => navigate('admin/menu')}
          >
            🍽️ Menu & stock
          </button>
          <button
            type="button"
            className={section === 'employes' ? 'is-active' : ''}
            onClick={() => navigate('admin/employes')}
          >
            👥 Employés
          </button>
        </nav>
        <UserMenu />
        <button type="button" className="btn btn-primary" onClick={() => navigate('caisse')}>
          ← Retour à la caisse
        </button>
      </header>

      <main className="admin-main">{section === 'menu' ? <MenuAdmin /> : <EmployeesAdmin />}</main>
    </div>
  );
}
