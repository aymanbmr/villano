import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi, api, ApiError, formatPrice, type Category, type Product } from '../../api';
import { ProductForm } from './ProductForm';
import { CategoriesAdmin } from './CategoriesAdmin';
import { Icon } from '../../components/Icon';
import { CategoryIcon } from '../../categoryIcons';
import { SHOW_STOCK } from '../../config';

const fail = (e: unknown) => (e instanceof ApiError ? e.message : 'Erreur réseau');

export function MenuAdmin() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [editing, setEditing] = useState<Product | null | 'new'>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cats, prods] = await Promise.all([api.categories(), api.products()]);
      setCategories(cats);
      setProducts(prods);
    } catch (e) {
      setError(fail(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => (filterCategory === '' ? true : String(p.categoryId ?? '') === filterCategory))
      .filter((p) => q === '' || p.name.toLowerCase().includes(q))
      .sort((a, b) => (a.category?.name ?? 'zzz').localeCompare(b.category?.name ?? 'zzz') || a.name.localeCompare(b.name));
  }, [products, search, filterCategory]);

  const lowStock = SHOW_STOCK ? products.filter((p) => p.stock <= p.lowStockThreshold).length : 0;

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(fail(e));
    }
  };

  const adjustStock = (p: Product) => {
    const raw = window.prompt(
      `Stock de « ${p.name} » : ${p.stock}\nQuantité à ajouter (négatif pour retirer) :`,
      '10',
    );
    if (raw === null) return;
    const delta = Number(raw);
    if (!Number.isInteger(delta) || delta === 0) return setError('Quantité invalide');
    void run(() => adminApi.adjustStock(p.id, delta));
  };

  const toggleAvailable = (p: Product) =>
    run(() => adminApi.updateProduct(p.id, { isAvailable: !p.isAvailable }));

  const remove = (p: Product) => {
    if (!window.confirm(`Supprimer « ${p.name} » définitivement ?\n(Pour le cacher temporairement, utilisez plutôt « Masquer ».)`)) return;
    void run(() => adminApi.deleteProduct(p.id));
  };

  return (
    <div className="menu-admin">
      <div className="menu-admin-main">
        <div className="toolbar">
          <input
            type="search"
            className="search"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input select-inline" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="toolbar-spacer" />
          {lowStock > 0 && (
            <span className="pill pill-warn pill-lg">
              <Icon name="alert" size={14} /> {lowStock} en stock bas
            </span>
          )}
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> Nouveau produit
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <table className="table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Catégorie</th>
              <th className="num">Prix</th>
              {SHOW_STOCK && <th className="num">Stock</th>}
              <th>Statut</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  Aucun produit.
                </td>
              </tr>
            )}
            {visible.map((p) => {
              const out = p.stock <= 0;
              const low = !out && p.stock <= p.lowStockThreshold;
              return (
                <tr key={p.id} className={p.isAvailable ? '' : 'is-hidden'}>
                  <td>
                    <div className="product-cell">
                      <div className="thumb">
                        {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <span>{p.name.charAt(0)}</span>}
                      </div>
                      <div>
                        <div className="strong-text">{p.name}</div>
                        {p.description && <div className="muted">{p.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td data-label="Catégorie">
                    {p.category ? (
                      <span className="cell-with-icon">
                        <CategoryIcon icon={p.category.icon} size={15} />
                        {p.category.name}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="num" data-label="Prix">{formatPrice(p.price)}</td>
                  {SHOW_STOCK && (
                  <td className="num" data-label="Stock">
                    <button
                      type="button"
                      className={`stock-btn${out ? ' is-out' : low ? ' is-low' : ''}`}
                      onClick={() => adjustStock(p)}
                      title="Ajuster le stock"
                    >
                      {p.stock}
                    </button>
                  </td>
                  )}
                  <td data-label="Statut">
                    {p.isAvailable ? (
                      <span className="status status-on">Visible</span>
                    ) : (
                      <span className="status status-off">Masqué</span>
                    )}
                  </td>
                  <td className="actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>
                      <Icon name="edit" size={14} /> Modifier
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleAvailable(p)}>
                      <Icon name={p.isAvailable ? 'eyeOff' : 'eye'} size={14} /> {p.isAvailable ? 'Masquer' : 'Afficher'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => remove(p)} title="Supprimer">
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CategoriesAdmin
        categories={categories}
        productCount={(id) => products.filter((p) => p.categoryId === id).length}
        onChanged={() => void load()}
        onError={setError}
      />

      {editing !== null && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          categories={categories}
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
