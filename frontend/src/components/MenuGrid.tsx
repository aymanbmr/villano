import { useMemo, useState } from 'react';
import type { Category, Product } from '../api';
import { ProductCard } from './ProductCard';
import { Icon } from './Icon';

interface Props {
  categories: Category[];
  products: Product[];
  quantityOf: (productId: number) => number;
  onAdd: (product: Product) => void;
}

const ALL = 0;

export function MenuGrid({ categories, products, quantityOf, onAdd }: Props) {
  const [categoryId, setCategoryId] = useState<number>(ALL);
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.isAvailable &&
        (categoryId === ALL || p.categoryId === categoryId) &&
        (q === '' || p.name.toLowerCase().includes(q)),
    );
  }, [products, categoryId, search]);

  return (
    <section className="menu">
      <div className="menu-toolbar">
        <label className="search-box">
          <Icon name="search" size={16} />
          <input
            type="search"
            className="search"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <nav className="category-tabs">
          <button
            type="button"
            className={`tab${categoryId === ALL ? ' is-active' : ''}`}
            onClick={() => setCategoryId(ALL)}
          >
            Tout
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`tab${categoryId === c.id ? ' is-active' : ''}`}
              onClick={() => setCategoryId(c.id)}
            >
              {c.icon && <span className="tab-icon">{c.icon}</span>}
              {c.name}
            </button>
          ))}
        </nav>
      </div>

      {visible.length === 0 ? (
        <p className="empty">Aucun produit.</p>
      ) : (
        <div className="product-grid">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} inCart={quantityOf(p.id)} onAdd={onAdd} />
          ))}
        </div>
      )}
    </section>
  );
}
