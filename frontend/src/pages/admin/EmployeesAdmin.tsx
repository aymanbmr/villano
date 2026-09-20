import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminApi,
  ApiError,
  EMPLOYEE_ROLES,
  formatPrice,
  type Employee,
  type EmployeeRole,
} from '../../api';
import { EmployeeForm } from './EmployeeForm';
import { Icon } from '../../components/Icon';

const fail = (e: unknown) => (e instanceof ApiError ? e.message : 'Erreur réseau');

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR');

export function EmployeesAdmin() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roleFilter, setRoleFilter] = useState<'' | EmployeeRole>('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Employee | null | 'new'>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEmployees(await adminApi.employees(true));
    } catch (e) {
      setError(fail(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () =>
      employees
        .filter((e) => showInactive || e.isActive)
        .filter((e) => roleFilter === '' || e.role === roleFilter),
    [employees, roleFilter, showInactive],
  );

  const countByRole = useMemo(() => {
    const map = new Map<EmployeeRole, number>();
    for (const e of employees) if (e.isActive) map.set(e.role, (map.get(e.role) ?? 0) + 1);
    return map;
  }, [employees]);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(fail(e));
    }
  };

  const toggleActive = (e: Employee) =>
    run(() => adminApi.updateEmployee(e.id, { isActive: !e.isActive }));

  const remove = (e: Employee) => {
    const msg =
      `Supprimer définitivement ${e.firstName} ${e.lastName} ?\n` +
      '(Pour un départ, préférez « Désactiver » afin de garder l’historique.)';
    if (!window.confirm(msg)) return;
    void run(() => adminApi.deleteEmployee(e.id));
  };

  return (
    <div className="employees-admin">
      <div className="role-cards">
        <button
          type="button"
          className={`role-card${roleFilter === '' ? ' is-active' : ''}`}
          onClick={() => setRoleFilter('')}
        >
          <div className="role-count">{employees.filter((e) => e.isActive).length}</div>
          <div>Tous</div>
        </button>
        {(Object.keys(EMPLOYEE_ROLES) as EmployeeRole[]).map((r) => (
          <button
            key={r}
            type="button"
            className={`role-card${roleFilter === r ? ' is-active' : ''}`}
            onClick={() => setRoleFilter(roleFilter === r ? '' : r)}
          >
            <div className="role-count">{countByRole.get(r) ?? 0}</div>
            <div>{EMPLOYEE_ROLES[r]}</div>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Afficher les anciens employés
        </label>
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> Nouvel employé
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>Employé</th>
            <th>Poste</th>
            <th>Téléphone</th>
            <th className="num">Salaire</th>
            <th>Embauché le</th>
            <th>Statut</th>
            <th className="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={7} className="empty">
                Aucun employé.
              </td>
            </tr>
          )}
          {visible.map((e) => (
            <tr key={e.id} className={e.isActive ? '' : 'is-hidden'}>
              <td>
                <div className="product-cell">
                  <div className="avatar">
                    {e.firstName.charAt(0)}
                    {e.lastName.charAt(0)}
                  </div>
                  <div>
                    <div className="strong-text">
                      {e.firstName} {e.lastName}
                    </div>
                    {e.notes && <div className="muted">{e.notes}</div>}
                  </div>
                </div>
              </td>
              <td>
                <span className={`role-badge role-${e.role}`}>{EMPLOYEE_ROLES[e.role]}</span>
              </td>
              <td>{e.phone ?? <span className="muted">—</span>}</td>
              <td className="num">
                {e.salary != null ? formatPrice(e.salary) : <span className="muted">—</span>}
              </td>
              <td>{e.hireDate ? formatDate(e.hireDate) : <span className="muted">—</span>}</td>
              <td>
                {e.isActive ? (
                  <span className="status status-on">Actif</span>
                ) : (
                  <span className="status status-off">Parti</span>
                )}
              </td>
              <td className="actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(e)}>
                  <Icon name="edit" size={14} /> Modifier
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleActive(e)}>
                  {e.isActive ? 'Désactiver' : 'Réactiver'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-danger"
                  onClick={() => remove(e)}
                  title="Supprimer"
                >
                  <Icon name="trash" size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing !== null && (
        <EmployeeForm
          employee={editing === 'new' ? null : editing}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
