import { CATEGORY_ICONS } from '../../categoryIcons';
import { Icon } from '../../components/Icon';

interface Props {
  value: string | null;
  onPick: (icon: string | null) => void;
  onClose: () => void;
}

// Grid of the available category icons (no emoji: see categoryIcons.tsx).
export function CategoryIconPicker({ value, onPick, onClose }: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal icon-picker" onClick={(e) => e.stopPropagation()}>
        <h2>Icône de la catégorie</h2>
        <div className="icon-grid">
          {CATEGORY_ICONS.map((i) => (
            <button
              key={i.id}
              type="button"
              className={`icon-choice${value === i.id ? ' is-active' : ''}`}
              title={i.label}
              onClick={() => {
                onPick(i.id);
                onClose();
              }}
            >
              <Icon name={i.id} size={22} />
              <span>{i.label}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              onPick(null);
              onClose();
            }}
          >
            Sans icône
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
