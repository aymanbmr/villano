import type { KeyboardEvent } from 'react';
import { formatPrice, type Product } from '../api';

interface Props {
  product: Product;
  inCart: number;
  onAdd: (product: Product) => void;
}

// Rendered as a div rather than a <button>: Chromium's button layout
// sometimes fails to grow around the image + body and clips the price.
export function ProductCard({ product, inCart, onAdd }: Props) {
  const remaining = product.stock - inCart;
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= product.lowStockThreshold;
  const disabled = outOfStock || remaining <= 0;

  const add = () => {
    if (!disabled) onAdd(product);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      add();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      className={`product-card${disabled ? ' is-disabled' : ''}`}
      onClick={add}
      onKeyDown={onKeyDown}
      title={outOfStock ? 'Rupture de stock' : `Ajouter ${product.name}`}
    >
      <div className="product-image">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy" />
        ) : (
          <div className="product-image-placeholder">{product.name.charAt(0)}</div>
        )}
        {outOfStock && <span className="product-out">Rupture</span>}
        {inCart > 0 && <span className="product-count">{inCart}</span>}
      </div>
      <div className="product-body">
        <div className="product-row">
          <div className="product-name">{product.name}</div>
          <div className="product-price">{formatPrice(product.price)}</div>
        </div>
        {product.description && <div className="product-desc">{product.description}</div>}
        <div className={`product-stock${outOfStock ? ' is-out' : lowStock ? ' is-low' : ''}`}>
          <span className="dot" />
          {outOfStock ? 'Épuisé' : `${remaining} en stock`}
        </div>
      </div>
    </div>
  );
}
