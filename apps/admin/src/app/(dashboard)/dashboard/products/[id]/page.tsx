'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Heading,
  Text,
  Badge,
  Button,
  Card,
  Input,
  Textarea,
  Switch,
  Separator,
  Tabs,
  TabPanel,
} from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';
const STOREFRONT_ID = 'cmtsybnj5006srtzxnmka1abc';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Category = { id: string; name: string; slug: string };

type Variant = {
  id: string;
  name: string;
  sku: string;
  price: number;
  inventory: number;
  attributes: Record<string, string>;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  cost: number | null;
  images: string[];
  categoryId: string | null;
  category: string | null;
  tags: string[];
  inventory: number;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: string;
};

type StockMovement = {
  id: string;
  type: string;
  quantity: number;
  reason: string;
  createdAt: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatPrice = (val: number) => `$${Number(val).toFixed(2)}`;

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const MOVEMENT_COLORS: Record<string, 'success' | 'danger' | 'neutral'> = {
  restock: 'success',
  sale: 'danger',
  adjustment: 'neutral',
  return: 'success',
  transfer: 'neutral',
};

const VARIANT_ATTR_LABELS: Record<string, string> = {
  color: 'Color',
  size: 'Size',
  material: 'Material',
  style: 'Style',
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  restock: 'Restock',
  sale: 'Sale',
  adjustment: 'Adjustment',
  return: 'Return',
  transfer: 'Transfer',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  // Product data
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState('overview');

  // Overview form
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    compareAtPrice: '',
    cost: '',
    images: '',
    categoryId: '',
    tags: '',
    isActive: true,
  });

  // Variants state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newVariant, setNewVariant] = useState({ name: '', sku: '', price: '', inventory: '0', attributes: '' });
  const [addingVariant, setAddingVariant] = useState(false);
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null);

  // Inventory state
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ quantity: '', reason: '', type: 'adjustment' });
  const [adjusting, setAdjusting] = useState(false);

  // ─── Toast helper ─────────────────────────────────────────────────────────────

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Load product ─────────────────────────────────────────────────────────────

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productRes, categoriesRes] = await Promise.all([
        fetch(`${API_BASE}/api/products/${productId}?tenantId=${TENANT_ID}`, { cache: 'no-store' }),
        fetch(`${API_BASE}/api/categories?storefrontId=${STOREFRONT_ID}`, { cache: 'no-store' }),
      ]);

      if (!productRes.ok) {
        const data = await productRes.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${productRes.status}`);
      }
      const productData: Product = await productRes.json();
      setProduct(productData);

      setForm({
        name: productData.name,
        description: productData.description || '',
        price: String(productData.price),
        compareAtPrice: productData.compareAtPrice ? String(productData.compareAtPrice) : '',
        cost: productData.cost ? String(productData.cost) : '',
        images: productData.images?.join(', ') || '',
        categoryId: productData.categoryId || '',
        tags: productData.tags?.join(', ') || '',
        isActive: productData.isActive,
      });

      const variantsRes = await fetch(`${API_BASE}/api/products/${productId}/variants?tenantId=${TENANT_ID}`, { cache: 'no-store' });
      if (variantsRes.ok) {
        const variantsData = await variantsRes.json();
        setVariants(Array.isArray(variantsData) ? variantsData : variantsData.variants || []);
      }

      const stockRes = await fetch(`${API_BASE}/api/products/${productId}/stock-movements?tenantId=${TENANT_ID}`, { cache: 'no-store' });
      if (stockRes.ok) {
        const stockData = await stockRes.json();
        setStockMovements(Array.isArray(stockData) ? stockData : []);
      }

      if (categoriesRes.ok) {
        const catsData = await categoriesRes.json();
        setCategories(Array.isArray(catsData) ? catsData : []);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load product.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (productId) loadProduct();
  }, [productId, loadProduct]);

  // ─── Save overview changes ────────────────────────────────────────────────────

  const handleSaveOverview = async () => {
    if (!product) return;
    setSaving(true);
    try {
      const payload = {
        tenantId: TENANT_ID,
        storefrontId: STOREFRONT_ID,
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price) || 0,
        compareAtPrice: form.compareAtPrice ? parseFloat(form.compareAtPrice) : null,
        cost: form.cost ? parseFloat(form.cost) : null,
        images: form.images ? form.images.split(',').map((s) => s.trim()).filter(Boolean) : [],
        categoryId: form.categoryId || null,
        tags: form.tags ? form.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
        isActive: form.isActive,
      };

      const res = await fetch(`${API_BASE}/api/products/${product.id}?tenantId=${TENANT_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      showToast('success', 'Product updated successfully.');
      loadProduct();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save product.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle active status ─────────────────────────────────────────────────────

  const toggleActive = async () => {
    if (!product) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/products/${product.id}?tenantId=${TENANT_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setForm((f) => ({ ...f, isActive: !f.isActive }));
      setProduct((p) => (p ? { ...p, isActive: !p.isActive } : p));
      showToast('success', product.isActive ? 'Product deactivated.' : 'Product activated.');
    } catch {
      showToast('error', 'Failed to update product status.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Add variant ──────────────────────────────────────────────────────────────

  const handleAddVariant = async () => {
    if (!product || !newVariant.name.trim() || !newVariant.sku.trim()) {
      showToast('error', 'Variant name and SKU are required.');
      return;
    }
    setAddingVariant(true);
    try {
      const attributes: Record<string, string> = {};
      if (newVariant.attributes.trim()) {
        newVariant.attributes.split(',').forEach((pair) => {
          const [key, val] = pair.split(':').map((s) => s.trim());
          if (key && val) attributes[key] = val;
        });
      }

      const payload = {
        tenantId: TENANT_ID,
        name: newVariant.name.trim(),
        sku: newVariant.sku.trim(),
        price: parseFloat(newVariant.price) || 0,
        inventory: parseInt(newVariant.inventory) || 0,
        attributes,
      };

      const res = await fetch(`${API_BASE}/api/products/${product.id}/variants?tenantId=${TENANT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      const created: Variant = await res.json();
      setVariants((prev) => [...prev, created]);
      setNewVariant({ name: '', sku: '', price: '', inventory: '0', attributes: '' });
      setAddDialogOpen(false);
      showToast('success', 'Variant added successfully.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add variant.';
      showToast('error', message);
    } finally {
      setAddingVariant(false);
    }
  };

  // ─── Delete variant ───────────────────────────────────────────────────────────

  const handleDeleteVariant = async () => {
    if (!deleteVariantId || !product) return;
    try {
      const res = await fetch(`${API_BASE}/api/products/${product.id}/variants/${deleteVariantId}?tenantId=${TENANT_ID}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete variant');
      setVariants((prev) => prev.filter((v) => v.id !== deleteVariantId));
      setDeleteVariantId(null);
      showToast('success', 'Variant deleted.');
    } catch {
      showToast('error', 'Failed to delete variant.');
    }
  };

  // ─── Adjust stock ─────────────────────────────────────────────────────────────

  const handleAdjustStock = async () => {
    if (!product || !adjustForm.reason.trim() || !adjustForm.quantity) {
      showToast('error', 'Quantity and reason are required.');
      return;
    }
    setAdjusting(true);
    try {
      const payload = {
        tenantId: TENANT_ID,
        type: adjustForm.type,
        quantity: parseInt(adjustForm.quantity),
        reason: adjustForm.reason.trim(),
      };

      const res = await fetch(`${API_BASE}/api/products/${product.id}/stock-movements?tenantId=${TENANT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      const movement: StockMovement = await res.json();
      setStockMovements((prev) => [movement, ...prev]);
      setAdjustDialogOpen(false);
      setAdjustForm({ quantity: '', reason: '', type: 'adjustment' });
      showToast('success', 'Stock adjusted successfully.');
      loadProduct();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to adjust stock.';
      showToast('error', message);
    } finally {
      setAdjusting(false);
    }
  };

  // ─── Loading / Error states ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-64 rounded bg-slate-200" />
          <div className="mt-4 h-4 w-48 rounded bg-slate-200" />
        </div>
        <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="h-5 w-32 rounded bg-slate-200" />
          <div className="h-4 w-full rounded bg-slate-200" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl">⚠️</div>
        <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">Product not found</Heading>
        <Text variant="muted" className="mt-2">{error || 'This product may have been deleted.'}</Text>
        <Button variant="outline" onClick={() => router.push('/dashboard/products')} className="mt-4">
          Back to Products
        </Button>
      </div>
    );
  }

  const marginPct = product.cost > 0 ? Math.round(((product.price - product.cost) / product.price) * 100) : null;
  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'variants', label: `Variants (${variants.length})` },
    { value: 'inventory', label: 'Inventory' },
  ];

  return (
    <>
      <div className="space-y-6">
        {/* ── Header ───────────────────────────────────────────────────────── */}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {product.images?.[0] ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="h-16 w-16 rounded-lg object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-slate-100 flex items-center justify-center text-2xl shrink-0">
                🏷️
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Heading as="h2" className="text-xl font-bold text-slate-900">{product.name}</Heading>
                <Badge variant={product.isActive ? 'success' : 'neutral'}>
                  {product.isActive ? 'Active' : 'Inactive'}
                </Badge>
                {product.inventory <= (product.lowStockThreshold || 5) && product.inventory > 0 && (
                  <Badge variant="warning">Low Stock</Badge>
                )}
                {product.inventory === 0 && (
                  <Badge variant="danger">Out of Stock</Badge>
                )}
              </div>
              <Text variant="muted" className="mt-0.5">SKU: {product.slug} · Created {formatDate(product.createdAt)}</Text>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/products')}>
              ← Back
            </Button>
            <Button variant="outline" size="sm" onClick={toggleActive} disabled={saving}>
              {product.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Price</Text>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatPrice(product.price)}</p>
          </Card>
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Compare At</Text>
            <p className="mt-1 text-lg font-bold text-slate-900">{product.compareAtPrice ? formatPrice(product.compareAtPrice) : '—'}</p>
          </Card>
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Cost</Text>
            <p className="mt-1 text-lg font-bold text-slate-900">{product.cost ? formatPrice(product.cost) : '—'}</p>
          </Card>
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Margin</Text>
            <p className="mt-1 text-lg font-bold text-slate-900">{marginPct !== null ? `${marginPct}%` : '—'}</p>
          </Card>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}

        <Card>
          <div className="border-b border-slate-200">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={[
                  'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 rounded-t-md',
                  activeTab === tab.value
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview Panel */}
          {activeTab === 'overview' && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Images */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Product Images</label>
                    {product.images?.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {product.images.map((img, i) => (
                          <div key={i} className="relative group">
                            <img
                              src={img}
                              alt={`${product.name} ${i + 1}`}
                              className="h-24 w-24 rounded-lg object-cover border border-slate-200"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-24 w-full rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-sm">
                        No images
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Image URLs (comma-separated)</label>
                    <Textarea
                      value={form.images}
                      onChange={(e) => setForm({ ...form, images: e.target.value })}
                      rows={2}
                      placeholder="https://example.com/img1.jpg, https://example.com/img2.jpg"
                    />
                  </div>
                </div>

                {/* Right: Form fields */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Product name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
                      <Input value={product.slug} disabled className="bg-slate-50 text-slate-500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={3}
                      placeholder="Product description..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Price ($) *</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.price}
                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Compare at Price</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.compareAtPrice}
                        onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
                        placeholder="99.99"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cost</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.cost}
                        onChange={(e) => setForm({ ...form, cost: e.target.value })}
                        placeholder="25.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                      <select
                        value={form.categoryId}
                        onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="">Select a category…</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tags (comma-separated)</label>
                      <Input
                        value={form.tags}
                        onChange={(e) => setForm({ ...form, tags: e.target.value })}
                        placeholder="sale, new, featured"
                      />
                    </div>
                  </div>

                  {/* SEO section */}
                  <div className="p-4 rounded-lg border border-slate-100 bg-slate-50/50 space-y-3">
                    <Heading as="h5" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SEO</Heading>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Meta Title</label>
                      <Input value={product.name} readOnly className="bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Meta Description</label>
                      <Input value={product.description || ''} readOnly className="bg-white text-sm" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.isActive}
                      onChange={() => setForm({ ...form, isActive: !form.isActive })}
                      id="product-active"
                    />
                    <label htmlFor="product-active" className="text-sm text-slate-700 cursor-pointer select-none">
                      Active (visible in storefront)
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <Button variant="outline" onClick={loadProduct} disabled={saving}>Reset</Button>
                <Button onClick={handleSaveOverview} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}

          {/* Variants Panel */}
          {activeTab === 'variants' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Text variant="muted">{variants.length} variant{variants.length !== 1 ? 's' : ''} total</Text>
                <Button size="sm" onClick={() => setAddDialogOpen(true)}>+ Add Variant</Button>
              </div>

              {variants.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">📦</div>
                  <Text variant="muted" className="text-sm">No variants yet. Add one to create product options.</Text>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50">
                        <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">SKU</th>
                        <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Price</th>
                        <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Inventory</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Attributes</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {variants.map((variant) => (
                        <tr key={variant.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-900">{variant.name}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{variant.sku}</code>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">{formatPrice(variant.price)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={variant.inventory <= 0 ? 'text-red-600 font-medium' : 'text-slate-600'}>
                              {variant.inventory}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(variant.attributes).map(([key, value]) => (
                                <span key={key} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                  {VARIANT_ATTR_LABELS[key] || key}: {value}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setDeleteVariantId(variant.id)}
                              className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Inventory Panel */}
          {activeTab === 'inventory' && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-4">
                  <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Current Stock</Text>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{product.inventory}</p>
                  <p className="text-xs text-slate-500 mt-1">units in stock</p>
                </Card>
                <Card className="p-4">
                  <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Low Stock Threshold</Text>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{product.lowStockThreshold || 5}</p>
                  <p className="text-xs text-slate-500 mt-1">units minimum</p>
                </Card>
                <Card className="p-4">
                  <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Stock Status</Text>
                  <div className="mt-1">
                    {product.inventory <= (product.lowStockThreshold || 5) && product.inventory > 0 ? (
                      <Badge variant="warning">Low Stock</Badge>
                    ) : product.inventory === 0 ? (
                      <Badge variant="danger">Out of Stock</Badge>
                    ) : (
                      <Badge variant="success">In Stock</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {product.inventory <= (product.lowStockThreshold || 5) && product.inventory > 0
                      ? 'Consider restocking soon'
                      : product.inventory === 0
                        ? 'Immediate restock needed'
                        : 'Stock level healthy'}
                  </p>
                </Card>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  Stock Movement History
                </Heading>
                <Button size="sm" onClick={() => setAdjustDialogOpen(true)}>+ Adjust Stock</Button>
              </div>

              {stockMovements.length === 0 ? (
                <div className="text-center py-8">
                  <Text variant="muted" className="text-sm">No stock movements recorded yet.</Text>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50">
                        <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Type</th>
                        <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Quantity</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Reason</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stockMovements.map((movement) => (
                        <tr key={movement.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <Badge variant={MOVEMENT_COLORS[movement.type] || 'neutral'} className="capitalize">
                              {MOVEMENT_TYPE_LABELS[movement.type] || movement.type}
                            </Badge>
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${movement.quantity > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{movement.reason || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(movement.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ─── Add Variant Dialog ───────────────────────────────────────────── */}

      {addDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAddDialogOpen(false)}>
          <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <Heading as="h3" className="text-lg font-semibold">Add Variant</Heading>
            <Text variant="muted" className="mt-1">Create a new variant for this product.</Text>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Variant Name *</label>
                <Input
                  value={newVariant.name}
                  onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                  placeholder="e.g., Large - Red"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SKU *</label>
                <Input
                  value={newVariant.sku}
                  onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })}
                  placeholder="e.g., PROD-L-RED"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newVariant.price}
                    onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Initial Inventory</label>
                  <Input
                    type="number"
                    min="0"
                    value={newVariant.inventory}
                    onChange={(e) => setNewVariant({ ...newVariant, inventory: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Attributes (key:value, comma-separated)</label>
                <Input
                  value={newVariant.attributes}
                  onChange={(e) => setNewVariant({ ...newVariant, attributes: e.target.value })}
                  placeholder="color:red, size:large"
                />
                <Text variant="small" className="text-slate-400 mt-1">e.g., color:red, size:large, material:cotton</Text>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setAddDialogOpen(false)} disabled={addingVariant}>Cancel</Button>
              <Button onClick={handleAddVariant} disabled={addingVariant}>
                {addingVariant ? 'Adding…' : 'Add Variant'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Delete Variant Confirmation ───────────────────────────────────── */}

      {deleteVariantId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteVariantId(null)}>
          <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <Heading as="h3" className="text-lg font-semibold text-slate-900">Delete Variant?</Heading>
            <Text variant="muted" className="mt-2">
              This action cannot be undone. The variant and its inventory data will be permanently removed.
            </Text>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteVariantId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteVariant}>Delete</Button>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Adjust Stock Dialog ───────────────────────────────────────────── */}

      {adjustDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAdjustDialogOpen(false)}>
          <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <Heading as="h3" className="text-lg font-semibold">Adjust Stock</Heading>
            <Text variant="muted" className="mt-1">
              Current stock: <span className="font-medium text-slate-700">{product.inventory}</span> units
            </Text>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Adjustment Type</label>
                <select
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="adjustment">Adjustment</option>
                  <option value="restock">Restock</option>
                  <option value="sale">Sale Deduction</option>
                  <option value="return">Return</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity Change</label>
                <Input
                  type="number"
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                  placeholder="Enter quantity (positive or negative)"
                />
                <Text variant="small" className="text-slate-400 mt-1">Use negative values to deduct stock</Text>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
                <Textarea
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  rows={2}
                  placeholder="Reason for stock adjustment..."
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setAdjustDialogOpen(false)} disabled={adjusting}>Cancel</Button>
              <Button onClick={handleAdjustStock} disabled={adjusting}>
                {adjusting ? 'Adjusting…' : 'Adjust Stock'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Toast ───────────────────────────────────────────────────────────── */}

      {toast && (
        <div
          className={[
            'fixed top-6 right-6 z-[60] rounded-lg px-5 py-3 shadow-lg text-sm font-medium transition-all',
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white',
          ].join(' ')}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
