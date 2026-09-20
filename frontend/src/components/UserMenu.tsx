import { isAdmin, logout, useSession } from '../auth';
import { navigate } from '../router';
import { Icon } from './Icon';

// Logged-in user + logout, shown in the app bar
export function UserMenu({ showAdminLink = false }: { showAdminLink?: boolean }) {
  const session = useSession();
  if (!session) return null;
  return (
    <div className="user-menu">
      {showAdminLink && isAdmin(session.user) && (
        <button type="button" className="btn btn-bar" onClick={() => navigate('admin/menu')}>
          <Icon name="settings" size={16} />
          <span>Admin</span>
        </button>
      )}
      <span className="user-name" title={session.user.role}>
        <Icon name="user" size={16} />
        <span>{session.user.name}</span>
      </span>
      <button type="button" className="btn btn-bar" onClick={logout} title="Se déconnecter">
        <Icon name="logout" size={16} />
        <span className="hide-sm">Déconnexion</span>
      </button>
    </div>
  );
}
