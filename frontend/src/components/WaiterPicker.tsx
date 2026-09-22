import { EMPLOYEE_ROLES, type EmployeeRole, type StaffMember } from '../api';
import { Icon } from './Icon';

interface Props {
  staff: StaffMember[];
  selectedId: number | null;
  onSelect: (staff: StaffMember) => void;
  onClose: () => void;
}

// Popup listing the active staff: the cashier picks who takes responsibility
// for the order (avoids disputes between waiters over a table).
export function WaiterPicker({ staff, selectedId, onSelect, onClose }: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal modal-form" onClick={(e) => e.stopPropagation()}>
        <h2>
          <Icon name="users" size={18} /> Serveur responsable
        </h2>

        {staff.length === 0 ? (
          <p className="empty">Aucun employé actif. Ajoutez-en un dans Admin → Employés.</p>
        ) : (
          <ul className="staff-list">
            {staff.map((s) => {
              const isSelected = s.id === selectedId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`staff-row${isSelected ? ' is-selected' : ''}`}
                    onClick={() => onSelect(s)}
                  >
                    <span className="avatar">
                      {s.firstName.charAt(0)}
                      {s.lastName.charAt(0)}
                    </span>
                    <span className="staff-row-name">
                      {s.firstName} {s.lastName}
                    </span>
                    <span className={`role-badge role-${s.role}`}>
                      {EMPLOYEE_ROLES[s.role as EmployeeRole] ?? s.role}
                    </span>
                    {isSelected && <Icon name="check" size={16} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
