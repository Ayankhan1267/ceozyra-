'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Heading, Text, Badge, Button, Card, Input } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';
const STOREFRONT_ID = 'cmtsybnj5006srtzxnmka1abc';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
};

type Variant = {
  id: string;
  name: string;
  sku: string;
  price: number;
  inventory: number;
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
  category: string | null;
  categoryId?: string | null;
  tags: string[];
  inventory: number;
  isActive: boolean;
  createdAt: string;
  variants?: Variant[];
};

type ProductFormData = {
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number | '';
  cost: number | '';
  images: string;
  categoryId: string;
  category: string;
  tags: string;
  inventory: number;
  isActive: boolean;
};

type PaginatedResponse = {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type SearchResponse = {
  products: Product[];
  total: number;
};

const emptyForm: ProductFormData = {
  name: '',
  slug: '',
  description: '',
  price: 0,
  compareAtPrice: '',
  cost: '',
  images: '',
  categoryId: '',
  category: '',
  tags: '',
  inventory: 0,
  isActive: true,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  // Products & state
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchMode, setSearchMode] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [newVariants, setNewVariants] = useState<Partial<Variant>[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Categories panel
  const [catPanelOpen, setCatPanelOpen] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', slug: '', description: '' });
  const [catSaving, setCatSaving] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  // Search debounce
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // ─── Fetch categories ────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/categories?storefrontId=${STOREFRONT_ID}`);
        if (res.ok) {
          const data = await res.json();
          setCategories(Array.isArray(data) ? data : []);
        }
      } catch { /* silently ignore */ }
    })();
  }, []);

  // ─── Load products ──────────────────────────────────────────────────────────

  const loadProducts = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tenantId: TENANT_ID,
        storefrontId: STOREFRONT_ID,
        page: String(pageNum),
        limit: String(limit),
      });
      if (statusFilter !== 'all') params.set('isActive', statusFilter === 'active' ? 'true' : 'false');
      if (categoryFilter !== 'all') params.set('categoryId', categoryFilter);

      const res = await fetch(`${API_BASE}/api/products/filter?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: PaginatedResponse = await res.json();
      setProducts(data.products || []);
      setPage(data.page || pageNum);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      setSearchMode(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load products.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, limit]);

  useEffect(() => {
    if (!searchMode) loadProducts(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter]);

  // ─── Search ─────────────────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) {
      setSearchMode(false);
      return;
    }
    searchTimer.current = setTimeout(() => {
      doSearch(value);
    }, 600);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      doSearch(search);
    }
  };

  const doSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchMode(false);
      loadProducts(1);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/products/search?q=${encodeURIComponent(query)}&tenantId=${TENANT_ID}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: SearchResponse = await res.json();
      setProducts(data.products || []);
      setSearchMode(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Search failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearch('');
    setSearchMode(false);
    loadProducts(1);
  };

  // ─── Toast helper ───────────────────────────────────────────────────────────

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Modal open / close ─────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setVariants([]);
    setNewVariants([]);
    setModalOpen(true);
  };

  const openEdit = async (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? '',
      cost: product.cost ?? '',
      images: product.images?.join(', ') || '',
      categoryId: product.categoryId || '',
      category: product.category || '',
      tags: product.tags?.join(', ') || '',
      inventory: product.inventory,
      isActive: product.isActive,
    });
    setVariants(product.variants || []);
    setNewVariants([]);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
    setVariants([]);
    setNewVariants([]);
  };

  // ─── Submit product ─────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.name || !form.slug || form.price <= 0) {
      showToast('error', 'Name, slug, and price are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tenantId: TENANT_ID,
        storefrontId: STOREFRONT_ID,
        name: form.name,
        slug: form.slug,
        description: form.description || null,
        price: form.price,
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null,
        cost: form.cost ? Number(form.cost) : null,
        images: form.images ? form.images.split(',').map(s => s.trim()).filter(Boolean) : [],
        categoryId: form.categoryId || null,
        category: form.category || null,
        tags: form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
        inventory: form.inventory,
        isActive: form.isActive,
      };

      const url = editingProduct
        ? `${API_BASE}/api/products/${editingProduct.id}`
        : `${API_BASE}/api/products?tenantId=${TENANT_ID}`;

      const res = await fetch(url, {
        method: editingProduct ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      const saved = editingProduct ? editingProduct : await res.json();

      // Add new variants
      if (newVariants.length > 0) {
        const productId = saved.id || editingProduct?.id;
        if (productId) {
          const variantPromises = newVariants.map((v) =>
            fetch(`${API_BASE}/api/products/${productId}/variants?tenantId=${TENANT_ID}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: v.name || '',
                sku: v.sku || '',
                price: Number(v.price) || 0,
                inventory: Number(v.inventory) || 0,
              }),
            })
          );
          await Promise.allSettled(variantPromises);
        }
      }

      showToast('success', editingProduct ? 'Product updated successfully.' : 'Product created successfully.');
      closeModal();
      if (searchMode) {
        doSearch(search);
      } else {
        loadProducts(page);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save product.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/products/${id}?tenantId=${TENANT_ID}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Product deleted.');
      setDeleteConfirm(null);
      if (searchMode) doSearch(search); else loadProducts(page);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete product.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle active ───────────────────────────────────────────────────────────

  const toggleActive = async (product: Product) => {
    try {
      const res = await fetch(`${API_BASE}/api/products/${product.id}?tenantId=${TENANT_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      showToast('success', product.isActive ? 'Product deactivated.' : 'Product activated.');
      if (searchMode) doSearch(search); else loadProducts(page);
    } catch {
      showToast('error', 'Failed to update product status.');
    }
  };

  // ─── Remove image ───────────────────────────────────────────────────────────

  const removeImage = async (productId: string, imageIndex: number) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/products/${productId}/images/${imageIndex}?tenantId=${TENANT_ID}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove image');
      showToast('success', 'Image removed.');
      // Refresh editing product data inline
      if (editingProduct) {
        const updatedImages = editingProduct.images.filter((_, i) => i !== imageIndex);
        setEditingProduct({ ...editingProduct, images: updatedImages });
        setForm({ ...form, images: updatedImages.join(', ') });
      }
      if (searchMode) doSearch(search); else loadProducts(page);
    } catch {
      showToast('error', 'Failed to remove image.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Add variant to pending list ────────────────────────────────────────────

  const addVariantRow = () => {
    setNewVariants([...newVariants, { name: '', sku: '', price: 0, inventory: 0 }]);
  };

  const updateNewVariant = (index: number, field: string, value: string | number) => {
    setNewVariants(newVariants.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  };

  // ─── Category panel helpers ─────────────────────────────────────────────────

  const openCatPanel = () => {
    setCatForm({ name: '', slug: '', description: '' });
    setEditingCat(null);
    setCatPanelOpen(true);
  };

  const closeCatPanel = () => {
    setCatPanelOpen(false);
    setEditingCat(null);
  };

  const handleCatSubmit = async () => {
    if (!catForm.name.trim() || !catForm.slug.trim()) {
      showToast('error', 'Name and slug are required for a category.');
      return;
    }
    setCatSaving(true);
    try {
      const payload = {
        storefrontId: STOREFRONT_ID,
        name: catForm.name.trim(),
        slug: catForm.slug.trim(),
        description: catForm.description.trim() || null,
      };
      const url = editingCat
        ? `${API_BASE}/api/categories/${editingCat.id}?tenantId=${TENANT_ID}`
        : `${API_BASE}/api/categories?tenantId=${TENANT_ID}`;
      const res = await fetch(url, {
        method: editingCat ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', editingCat ? 'Category updated.' : 'Category created.');
      setCatForm({ name: '', slug: '', description: '' });
      setEditingCat(null);
      // Reload categories
      const cRes = await fetch(`${API_BASE}/api/categories?storefrontId=${STOREFRONT_ID}`);
      if (cRes.ok) {
        const cData = await cRes.json();
        setCategories(Array.isArray(cData) ? cData : []);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save category.';
      showToast('error', message);
    } finally {
      setCatSaving(false);
    }
  };

  const handleCatDelete = async (catId: string) => {
    setCatSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/categories/${catId}?tenantId=${TENANT_ID}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('success', 'Category deleted.');
      const cRes = await fetch(`${API_BASE}/api/categories?storefrontId=${STOREFRONT_ID}`);
      if (cRes.ok) {
        const cData = await cRes.json();
        setCategories(Array.isArray(cData) ? cData : []);
      }
      if (editingCat?.id === catId) {
        setEditingCat(null);
        setCatForm({ name: '', slug: '', description: '' });
      }
    } catch {
      showToast('error', 'Failed to delete category.');
    } finally {
      setCatSaving(false);
    }
  };

  const startEditCat = (cat: Category) => {
    setEditingCat(cat);
    setCatForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
    });
  };

  // ─── Formatting helpers ──────────────────────────────────────────────────────

  const formatPrice = (val: number) => `$${Number(val).toFixed(2)}`;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Heading as="h2" className="text-2xl font-bold text-slate-900">Products</Heading>
            <Text variant="muted" className="mt-1">Manage your storefront products</Text>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openCatPanel}>
              Manage Categories
            </Button>
            <Button onClick={openCreate}>+ Add Product</Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col gap-3">
            {/* Search row */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Input
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search products by name or slug…"
                  className="w-full"
                />
                {searchMode && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 underline"
                    type="button"
                  >
                    Clear
                  </button>
                )}
              </div>
              {searchMode && (
                <Badge variant="info">Searching: &ldquo;{search}&rdquo;</Badge>
              )}
            </div>

            {/* Filter controls row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Category filter */}
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Status filter */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {(['all', 'active', 'inactive'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setStatusFilter(f); setPage(1); }}
                    className={[
                      'px-3 py-2 text-sm font-medium transition-colors',
                      statusFilter === f ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Inactive'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => { setSearchMode(false); loadProducts(1); }} className="ml-3 underline font-medium">Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
                <div className="h-5 w-48 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-32 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        )}

        {/* Products list */}
        {!loading && !error && (
          products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl">📦</div>
              <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">No products found</Heading>
              <Text variant="muted" className="mt-2">
                {searchMode ? 'Try a different search term.' : 'Create your first product to get started.'}
              </Text>
              {searchMode && (
                <button onClick={clearSearch} className="mt-3 underline text-indigo-600 text-sm">Clear search</button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {products.map((product) => (
                  <Card key={product.id} className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Thumbnail */}
                        {product.images?.[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="h-14 w-14 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-lg bg-slate-100 flex items-center justify-center text-2xl shrink-0">
                            🏷️
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Heading as="h4" className="text-sm font-semibold text-slate-900 truncate">
                              {product.name}
                            </Heading>
                            <Badge variant={product.isActive ? 'success' : 'neutral'}>
                              {product.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            {product.inventory <= 5 && product.inventory > 0 && (
                              <Badge variant="warning">Low Stock</Badge>
                            )}
                            {product.inventory === 0 && (
                              <Badge variant="danger">Out of Stock</Badge>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span className="font-medium">{formatPrice(product.price)}</span>
                            {product.compareAtPrice && (
                              <span className="line-through text-slate-400">{formatPrice(product.compareAtPrice)}</span>
                            )}
                            <span>Stock: {product.inventory}</span>
                            {product.category && <span>• {product.category}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => toggleActive(product)}>
                          {product.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(product)}>Edit</Button>
                        <button
                          onClick={() => setDeleteConfirm(product.id)}
                          className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {!searchMode && totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <Text variant="muted" className="text-xs">
                    Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} products
                  </Text>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadProducts(page - 1)}
                      disabled={page <= 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                      ← Previous
                    </button>
                    <span className="text-sm text-slate-600">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => loadProducts(page + 1)}
                      disabled={page >= totalPages}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* ─── Create / Edit Modal ──────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <Heading as="h3" className="text-lg font-semibold">
                  {editingProduct ? 'Edit Product' : 'Create Product'}
                </Heading>
                <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
              </div>

              <div className="mt-6 space-y-4">
                {/* Name / Slug row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Product name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Slug *</label>
                    <Input
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      placeholder="product-slug"
                    />
                  </div>
                </div>

                {/* Full description */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Product description..."
                  />
                </div>

                {/* Price row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Price ($) *</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Compare at Price</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.compareAtPrice}
                      onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value ? parseFloat(e.target.value) : '' })}
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
                      onChange={(e) => setForm({ ...form, cost: e.target.value ? parseFloat(e.target.value) : '' })}
                      placeholder="25.00"
                    />
                  </div>
                </div>

                {/* Inventory / Category row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Inventory</label>
                    <Input
                      type="number"
                      min="0"
                      value={form.inventory}
                      onChange={(e) => setForm({ ...form, inventory: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <select
                      value={form.categoryId}
                      onChange={(e) => setForm({ ...form, categoryId: e.target.value, category: categories.find(c => c.id === e.target.value)?.name || form.category })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Select a category…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Images */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Image URLs (comma-separated)</label>
                  <Input
                    value={form.images}
                    onChange={(e) => setForm({ ...form, images: e.target.value })}
                    placeholder="https://example.com/img1.jpg, https://example.com/img2.jpg"
                  />
                  {/* Thumbnail previews */}
                  {form.images.split(',').map((url, i) => {
                    const trimmed = url.trim();
                    if (!trimmed) return null;
                    return (
                      <div key={i} className="relative inline-block mt-2 mr-2">
                        <img
                          src={trimmed}
                          alt={`Preview ${i + 1}`}
                          className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        {editingProduct && (
                          <button
                            type="button"
                            onClick={() => removeImage(editingProduct.id, i)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                            title="Remove image"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tags (comma-separated)</label>
                  <Input
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    placeholder="sale, new, featured"
                  />
                </div>

                {/* Active checkbox */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-slate-700">Active (visible in storefront)</label>
                </div>

                {/* ─── Variants section ───────────────────────────────────────── */}
                {editingProduct && (
                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <Heading as="h4" className="text-sm font-semibold text-slate-800">Variants</Heading>
                      <button
                        type="button"
                        onClick={addVariantRow}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        + Add Variant
                      </button>
                    </div>

                    {/* Existing variants */}
                    {variants.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {variants.map((v) => (
                          <div key={v.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                            <span className="font-medium text-slate-700">{v.name || '—'}</span>
                            <span className="text-slate-500">SKU: {v.sku || '—'}</span>
                            <span className="text-slate-500">Price: {formatPrice(v.price)}</span>
                            <span className="text-slate-500">Inventory: {v.inventory}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {newVariants.length === 0 && variants.length === 0 && (
                      <Text variant="muted" className="text-xs mb-2">No variants yet. Click "+ Add Variant" to create one.</Text>
                    )}

                    {newVariants.map((v, i) => (
                      <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                        <Input
                          placeholder="Name"
                          value={v.name || ''}
                          onChange={(e) => updateNewVariant(i, 'name', e.target.value)}
                        />
                        <Input
                          placeholder="SKU"
                          value={v.sku || ''}
                          onChange={(e) => updateNewVariant(i, 'sku', e.target.value)}
                        />
                        <Input
                          type="number"
                          placeholder="Price"
                          value={v.price ?? ''}
                          onChange={(e) => updateNewVariant(i, 'price', e.target.value)}
                        />
                        <Input
                          type="number"
                          placeholder="Inventory"
                          value={v.inventory ?? ''}
                          onChange={(e) => updateNewVariant(i, 'inventory', e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <Button variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving ? 'Saving…' : editingProduct ? 'Update Product' : 'Create Product'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Delete Confirmation ─────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <Heading as="h3" className="text-lg font-semibold text-slate-900">Delete Product?</Heading>
            <Text variant="muted" className="mt-2">
              This action cannot be undone. The product and all related data will be permanently removed.
            </Text>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)} disabled={saving}>
                {saving ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Toast ───────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={[
          'fixed top-6 right-6 z-[60] rounded-lg px-5 py-3 shadow-lg text-sm font-medium transition-all',
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white',
        ].join(' ')} role="alert">
          {toast.message}
        </div>
      )}

      {/* ─── Categories Slide-in Panel ───────────────────────────────────────── */}
      {catPanelOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/40" onClick={closeCatPanel} />

          {/* Panel */}
          <div className="w-full max-w-md bg-white shadow-xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <Heading as="h3" className="text-lg font-semibold">Manage Categories</Heading>
              <button onClick={closeCatPanel} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>

            {/* Add / Edit form */}
            <div className="p-6 border-b border-slate-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                  <Input
                    value={catForm.name}
                    onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                    placeholder="Category name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Slug *</label>
                  <Input
                    value={catForm.slug}
                    onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })}
                    placeholder="category-slug"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea
                  value={catForm.description}
                  onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Optional description…"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCatSubmit}
                  disabled={catSaving}
                >
                  {catSaving ? 'Saving…' : editingCat ? 'Update Category' : 'Add Category'}
                </Button>
                {editingCat && (
                  <Button size="sm" variant="outline" onClick={() => { setEditingCat(null); setCatForm({ name: '', slug: '', description: '' }); }}>
                    Cancel Edit
                  </Button>
                )}
              </div>
            </div>

            {/* Category list */}
            <div className="flex-1 overflow-y-auto p-4">
              {categories.length === 0 && (
                <Text variant="muted" className="text-sm text-center py-8">No categories yet. Add your first one above.</Text>
              )}
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-slate-800">{cat.name}</span>
                      <span className="ml-2 text-xs text-slate-400">/{cat.slug}</span>
                      {cat.description && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{cat.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={() => startEditCat(cat)}
                        className="text-xs px-2 py-1 rounded text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleCatDelete(cat.id)}
                        disabled={catSaving}
                        className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
