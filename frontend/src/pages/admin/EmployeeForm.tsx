import { useState, type FormEvent } from 'react';
import {
  adminApi,
  ApiError,
  EMPLOYEE_ROLES,
  type Employee,
  type EmployeePayload,
  type EmployeeRole,
} from '../../api';

interface Props {
  employee: Employee | null; // null = create
  onSaved: () => void;
  onClose: () => void;
}

export function EmployeeForm({ employee, onSaved, onClose }: Props) {
  const [firstName, setFirstName] = useState(employee?.firstName ?? '');
  const [lastName, setLastName] = useState(employee?.lastName ?? '');
  const [role, setRole] = useState<EmployeeRole>(employee?.role ?? 'serveur');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [salary, setSalary] = useState(employee?.salary != null ? String(employee.salary) : '');
  const [hireDate, setHireDate] = useState(employee?.hireDate ?? '');
  const [pin, setPin] = useState(employee?.pin ?? '');
  const [notes, setNotes] = useState(employee?.notes ?? '');
  const [isActive, setIsActive] = useState(employee?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) return setError('Prénom et nom sont obligatoires');
    if (pin && !/^\d{4,6}$/.test(pin)) return setError('Le code PIN doit contenir 4 à 6 chiffres');

    const payload: EmployeePayload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      phone: phone.trim() || null,
      salary: salary === '' ? null : Number(salary),
      hireDate: hireDate || null,
      pin: pin || null,
      notes: notes.trim() || null,
      isActive,
    };

    setSaving(true);
    try {
      if (employee) await adminApi.updateEmployee(employee.id, payload);
      else await adminApi.createEmployee(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal modal-form" onSubmit={submit}>
        <h2>{employee ? 'Modifier l’employé' : 'Nouvel employé'}</h2>

        <div className="form-grid">
          <label className="field">
            <span>Prénom *</span>
            <input
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
            />
          </label>
          <label className="field">
            <span>Nom *</span>
            <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>

          <label className="field">
            <span>Poste *</span>
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as EmployeeRole)}
            >
              {Object.entries(EMPLOYEE_ROLES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Téléphone</span>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 00 00 00 00"
            />
          </label>

          <label className="field">
            <span>Salaire mensuel (DH)</span>
            <input
              className="input"
              type="number"
              min={0}
              step="50"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Date d’embauche</span>
            <input
              className="input"
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Code PIN (caisse)</span>
            <input
              className="input"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="4 à 6 chiffres"
            />
          </label>
          <label className="checkbox field">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Employé actif
          </label>

          <label className="field field-full">
            <span>Notes</span>
            <input
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Horaires, remarques…"
            />
          </label>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
