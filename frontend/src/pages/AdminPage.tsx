import { navigate } from '../router';
import { MenuAdmin } from './admin/MenuAdmin';
import { EmployeesAdmin } from './admin/EmployeesAdmin';
import { UserMenu } from '../components/UserMenu';
import { AppBar } from '../components/AppBar';
import { Icon } from '../components/Icon';

export type AdminSection = 'menu' | 'employes';

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
              <span>Caisse</span>
            </button>
          </>
        }
      >
        <nav className="admin-nav">
          <button
            type="button"
            className={section === 'menu' ? 'is-active' : ''}
            onClick={() => navigate('admin/menu')}
          >
            <Icon name="grid" size={16} />
            <span>Menu &amp; stock</span>
          </button>
          <button
            type="button"
            className={section === 'employes' ? 'is-active' : ''}
            onClick={() => navigate('admin/employes')}
          >
            <Icon name="users" size={16} />
            <span>Employés</span>
          </button>
        </nav>
      </AppBar>

      <main className="admin-main">{section === 'menu' ? <MenuAdmin /> : <EmployeesAdmin />}</main>
    </div>
  );
}
