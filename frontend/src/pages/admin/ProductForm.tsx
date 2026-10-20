import { useState, type FormEvent } from 'react';
import { adminApi, ApiError, type Category, type Product, type ProductPayload } from '../../api';
import { SHOW_STOCK } from '../../config';

/** Valeur réservée du menu déroulant : elle ouvre le champ au lieu de choisir. */
const NOUVELLE = '__nouvelle__';

interface Props {
  product: Product | null; // null = create
  categories: Category[];
  onSaved: () => void;
  onClose: () => void;
}

export function ProductForm({ product, categories, onSaved, onClose }: Props) {
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [stock, setStock] = useState(product ? String(product.stock) : '0');
  const [lowStockThreshold, setLowStockThreshold] = useState(
    product ? String(product.lowStockThreshold) : '5',
  );
  const [categoryId, setCategoryId] = useState<string>(
    product?.categoryId ? String(product.categoryId) : '',
  );
  // Les catégories sont fournies par la page, mais on peut en créer une sans
  // quitter le formulaire : sinon, ajouter un produit dans une catégorie qui
  // n'existe pas encore obligeait à tout fermer et à revenir.
  const [cats, setCats] = useState(categories);
  // Nom en cours de saisie, ou null quand le champ est replié
  const [nouvelleCategorie, setNouvelleCategorie] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(product?.isAvailable ?? true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(product?.imageUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creerCategorie = async () => {
    const nom = (nouvelleCategorie ?? '').trim();
    if (!nom) return;
    // Placée à la fin : l'ordre se règle dans l'encadré Catégories, où les
    // flèches permettent de la remonter.
    try {
      const creee = await adminApi.createCategory({ name: nom, icon: null, sortOrder: cats.length });
      setCats([...cats, creee]);
      setCategoryId(String(creee.id));
      setNouvelleCategorie(null);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur réseau');
    }
  };

  const pickImage = (file: File | null) => {
    setImageFile(file);
    setPreview(file ? URL.createObjectURL(file) : (product?.imageUrl ?? null));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: ProductPayload = {
      name: name.trim(),
      description: description.trim() || null,
      price: Number(price),
      stock: Number(stock) || 0,
      lowStockThreshold: Number(lowStockThreshold) || 0,
      categoryId: categoryId ? Number(categoryId) : null,
      isAvailable,
    };
    if (!payload.name) return setError('Le nom est obligatoire');
    if (Number.isNaN(payload.price) || payload.price < 0) return setError('Prix invalide');

    setSaving(true);
    try {
      const saved = product
        ? await adminApi.updateProduct(product.id, payload)
        : await adminApi.createProduct(payload);
      if (imageFile) await adminApi.uploadProductImage(saved.id, imageFile);
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
        <h2>{product ? 'Modifier le produit' : 'Nouveau produit'}</h2>

        <div className="form-grid">
          <label className="field field-full">
            <span>Nom *</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>

          <label className="field">
            <span>Prix (DH) *</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.5"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Catégorie</span>
            <select
              className="input"
              value={categoryId}
              onChange={(e) =>
                e.target.value === NOUVELLE
                  ? setNouvelleCategorie('')
                  : setCategoryId(e.target.value)
              }
            >
              <option value="">— Sans catégorie —</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}
                  {c.name}
                </option>
              ))}
              <option value={NOUVELLE}>+ Nouvelle catégorie…</option>
            </select>
          </label>

          {nouvelleCategorie !== null && (
            <div className="field category-inline">
              <input
                className="input"
                value={nouvelleCategorie}
                onChange={(e) => setNouvelleCategorie(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); // sinon la touche enregistrerait le produit
                    void creerCategorie();
                  }
                }}
                placeholder="Nom de la catégorie"
                autoFocus
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void creerCategorie()}>
                Créer
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setNouvelleCategorie(null)}
              >
                Annuler
              </button>
            </div>
          )}

          {SHOW_STOCK && (
            <>
              <label className="field">
                <span>Stock</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="1"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </label>

              <label className="field">
                <span>Alerte stock bas à</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="1"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                />
              </label>
            </>
          )}

          <label className="field field-full">
            <span>Description</span>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Poulet, olives, citron confit…"
            />
          </label>

          <div className="field field-full image-field">
            <span>Photo</span>
            <div className="image-picker">
              <div className="image-preview">
                {preview ? <img src={preview} alt="" /> : <span>Aucune image</span>}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                />
                <div className="muted">JPG, PNG ou WebP, 5 Mo max</div>
              </div>
            </div>
          </div>

          <label className="checkbox field-full">
            <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
            Visible sur la caisse
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
