import { useState } from 'react';
import { TABLE_COUNT } from '../config';
import { Icon } from './Icon';

interface Props {
  selected: string;
  // Table numbers already busy with another open order
  occupied: string[];
  onSelect: (table: string) => void;
  onClose: () => void;
}

// Visual floor plan: each table is drawn with chairs side by side, so the
// waiter recognizes it at a glance instead of typing a number.
export function TablePicker({ selected, occupied, onSelect, onClose }: Props) {
  const [custom, setCustom] = useState('');
  const occupiedSet = new Set(occupied);
  const tables = Array.from({ length: TABLE_COUNT }, (_, i) => String(i + 1));

  const pickCustom = () => {
    const value = custom.trim();
    if (value) onSelect(value);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal modal-form table-picker" onClick={(e) => e.stopPropagation()}>
        <h2>
          <Icon name="grid" size={18} /> Choisir une table
        </h2>

        <div className="table-legend">
          <span className="table-legend-item">
            <span className="table-swatch" /> Libre
          </span>
          <span className="table-legend-item">
            <span className="table-swatch is-occupied" /> Occupée
          </span>
          <span className="table-legend-item">
            <span className="table-swatch is-selected" /> Sélectionnée
          </span>
        </div>

        <div className="table-grid">
          {tables.map((t) => {
            const isSelected = t === selected;
            const isOccupied = occupiedSet.has(t) && !isSelected;
            return (
              <button
                key={t}
                type="button"
                className={`table-spot${isSelected ? ' is-selected' : ''}${isOccupied ? ' is-occupied' : ''}`}
                onClick={() => onSelect(t)}
                title={isOccupied ? `Table ${t} · occupée` : `Table ${t}`}
              >
                <span className="table-chairs">
                  <span className="chair" />
                  <span className="chair" />
                </span>
                <span className="table-surface">{t}</span>
                <span className="table-chairs">
                  <span className="chair" />
                  <span className="chair" />
                </span>
              </button>
            );
          })}
        </div>

        <div className="table-custom">
          <input
            className="input"
            placeholder="Autre numéro (terrasse, étage…)"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && pickCustom()}
          />
          <button type="button" className="btn btn-ghost" disabled={!custom.trim()} onClick={pickCustom}>
            OK
          </button>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
