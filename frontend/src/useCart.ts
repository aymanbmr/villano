import { useCallback, useMemo, useState } from 'react';
import type { Product } from './api';

export interface CartLine {
  product: Product;
  quantity: number;
}

// Cart state for the caisse. Quantities are clamped to the product's stock
// so the cashier can never build an order the backend would reject.
export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = useCallback((product: Product) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (!existing) {
        return product.stock > 0 ? [...prev, { product, quantity: 1 }] : prev;
      }
      if (existing.quantity >= product.stock) return prev;
      return prev.map((l) =>
        l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l,
      );
    });
  }, []);

  const setQuantity = useCallback((productId: number, quantity: number) => {
    setLines((prev) =>
      prev
        .map((l) =>
          l.product.id === productId
            ? { ...l, quantity: Math.min(Math.max(0, quantity), l.product.stock) }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const remove = useCallback((productId: number) => {
    setLines((prev) => prev.filter((l) => l.product.id !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  // After a refresh of the product list, keep the cart in sync with new stock
  const syncProducts = useCallback((products: Product[]) => {
    setLines((prev) =>
      prev
        .map((l) => {
          const fresh = products.find((p) => p.id === l.product.id);
          if (!fresh || !fresh.isAvailable) return null;
          return { product: fresh, quantity: Math.min(l.quantity, fresh.stock) };
        })
        .filter((l): l is CartLine => l !== null && l.quantity > 0),
    );
  }, []);

  const subtotal = useMemo(
    () => Math.round(lines.reduce((s, l) => s + l.product.price * l.quantity, 0) * 100) / 100,
    [lines],
  );
  const count = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);

  const quantityOf = useCallback(
    (productId: number) => lines.find((l) => l.product.id === productId)?.quantity ?? 0,
    [lines],
  );

  return { lines, add, setQuantity, remove, clear, syncProducts, subtotal, count, quantityOf };
}
