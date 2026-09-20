import { useState } from 'react';
import { adminApi, ApiError, type Category } from '../../api';

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
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');

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
      <ul className="category-list">
        {categories.map((c) =>
          editingId === c.id ? (
            <li key={c.id} className="category-edit">
              <input
                className="input input-icon"
                value={editIcon}
                onChange={(e) => setEditIcon(e.target.value)}
                placeholder="☕"
                maxLength={4}
              />
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
                ✕
              </button>
            </li>
          ) : (
            <li key={c.id}>
              <span className="category-name">
                {c.icon && <span className="tab-icon">{c.icon}</span>}
                {c.name}
                <span className="muted"> · {productCount(c.id)}</span>
              </span>
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
      <div className="category-add">
        <input
          className="input input-icon"
          value={newIcon}
          onChange={(e) => setNewIcon(e.target.value)}
          placeholder="🍕"
          maxLength={4}
        />
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
