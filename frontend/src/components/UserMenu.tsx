import { isAdmin, logout, useSession } from '../auth';
import { navigate } from '../router';

// Logged-in user + logout, shown in the caisse and admin headers
export function UserMenu({ showAdminLink = false }: { showAdminLink?: boolean }) {
  const session = useSession();
  if (!session) return null;
  return (
    <div className="user-menu">
      {showAdminLink && isAdmin(session.user) && (
        <button type="button" className="btn btn-ghost" onClick={() => navigate('admin/menu')}>
          ⚙ Admin
        </button>
      )}
      <span className="user-name" title={session.user.role}>
        👤 {session.user.name}
      </span>
      <button type="button" className="btn btn-ghost" onClick={logout} title="Se déconnecter">
        Déconnexion
      </button>
    </div>
  );
}
