import { useState } from 'react';
import { adminApi, ApiError, type Category } from '../../api';
import { CategoryIcon } from '../../categoryIcons';
import { Icon } from '../../components/Icon';
import { CategoryIconPicker } from './CategoryIconPicker';

interface Props {
  categories: Category[];
  productCount: (categoryId: number) => number;
  onChanged: () => void;
  onError: (message: string) => void;
}

const fail = (e: unknown) => (e instanceof ApiError ? e.message : 'Erreur réseau');

// Side panel: add / rename / delete categories
export function CategoriesAdmin({ categories, productCount, onChanged, onError }: Props) {
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  // which field the icon picker is open for: 'new', a category id, or null
  const [picking, setPicking] = useState<'new' | number | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [moving, setMoving] = useState(false);

  /**
   * Monte ou descend une catégorie d'un cran. L'ordre choisi ici est celui des
   * onglets de la caisse, et aussi celui des produits dans l'onglet « Tous » :
   * mettre les boissons chaudes en premier les y fait remonter.
   */
  const move = async (index: number, delta: number) => {
    const cible = index + delta;
    if (cible < 0 || cible >= categories.length || moving) return;
    const ordre = [...categories];
    [ordre[index], ordre[cible]] = [ordre[cible], ordre[index]];
    setMoving(true);
    try {
      // On renumérote toute la liste au lieu d'échanger deux valeurs : à
      // l'import, les catégories partagent souvent le même rang, et échanger
      // deux rangs identiques ne changerait rien à l'affichage.
      const aEnvoyer = ordre
        .map((c, rang) => ({ c, rang }))
        .filter(({ c, rang }) => c.sortOrder !== rang);
      for (const { c, rang } of aEnvoyer) {
        await adminApi.updateCategory(c.id, { sortOrder: rang });
      }
      onChanged();
    } catch (e) {
      onError(fail(e));
    } finally {
      setMoving(false);
    }
  };

  const add = async () => {
    if (!newName.trim()) return;
    try {
      await adminApi.createCategory({
        name: newName.trim(),
        icon: newIcon.trim() || null,
        sortOrder: categories.length,
      });
      setNewName('');
      setNewIcon('');
      onChanged();
    } catch (e) {
      onError(fail(e));
    }
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditIcon(c.icon ?? '');
  };

  const saveEdit = async () => {
    if (editingId === null || !editName.trim()) return;
    try {
      await adminApi.updateCategory(editingId, { name: editName.trim(), icon: editIcon.trim() || null });
      setEditingId(null);
      onChanged();
    } catch (e) {
      onError(fail(e));
    }
  };

  const remove = async (c: Category) => {
    const n = productCount(c.id);
    const msg =
      n > 0
        ? `Supprimer « ${c.name} » ? Les ${n} produit(s) resteront sans catégorie.`
        : `Supprimer « ${c.name} » ?`;
    if (!window.confirm(msg)) return;
    try {
      await adminApi.deleteCategory(c.id);
      onChanged();
    } catch (e) {
      onError(fail(e));
    }
  };

  return (
    <section className="card categories-admin">
      <h3>Catégories</h3>
      <div className="muted category-hint">
        Cet ordre est celui des onglets de la caisse, et celui des produits dans « Tous ».
      </div>
      <ul className="category-list">
        {categories.map((c, index) =>
          editingId === c.id ? (
            <li key={c.id} className="category-edit">
              <button
                type="button"
                className="btn btn-ghost icon-button"
                onClick={() => setPicking(c.id)}
                title="Choisir une icône"
              >
                {editIcon ? <CategoryIcon icon={editIcon} size={18} /> : <Icon name="image" size={16} />}
              </button>
              <input
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                autoFocus
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit}>
                OK
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                <Icon name="x" size={14} />
              </button>
            </li>
          ) : (
            <li key={c.id}>
              <span className="category-name">
                <CategoryIcon icon={c.icon} size={15} />
                {c.name}
                <span className="muted"> · {productCount(c.id)}</span>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void move(index, -1)}
                disabled={index === 0 || moving}
                title="Monter"
              >
                <Icon name="up" size={14} />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void move(index, 1)}
                disabled={index === categories.length - 1 || moving}
                title="Descendre"
              >
                <Icon name="down" size={14} />
              </button>
              <button type="button" className="btn-link" onClick={() => startEdit(c)}>
                Modifier
              </button>
              <button type="button" className="btn-link btn-danger" onClick={() => remove(c)}>
                Suppr.
              </button>
            </li>
          ),
        )}
      </ul>
      {picking !== null && (
        <CategoryIconPicker
          value={picking === 'new' ? newIcon || null : editIcon || null}
          onPick={(icon) => (picking === 'new' ? setNewIcon(icon ?? '') : setEditIcon(icon ?? ''))}
          onClose={() => setPicking(null)}
        />
      )}

      <div className="category-add">
        <button
                type="button"
                className="btn btn-ghost icon-button"
                onClick={() => setPicking('new')}
                title="Choisir une icône"
              >
                {newIcon ? <CategoryIcon icon={newIcon} size={18} /> : <Icon name="image" size={16} />}
              </button>
        <input
          className="input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Nouvelle catégorie"
        />
        <button type="button" className="btn btn-primary btn-sm" onClick={add}>
          Ajouter
        </button>
      </div>
    </section>
  );
}
