'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Heading, Text, Badge, Button, Card, Input, Label, Select, Sheet } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Types ──────────────────────────────────────────────────────────────────────

type Supplier = {
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  contactPerson: string | null;
  paymentTerms: string | null;
  isActive: boolean;
  createdAt: string;
};

type SuppliersList = {
  suppliers: Supplier[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type SupplierStats = {
  totalOrders: number;
  pendingOrders: number;
  receivedOrders: number;
  cancelledOrders: number;
  totalSpend: number;
  avgDeliveryDays: number | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('all');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Modal
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    contactPerson: '',
    paymentTerms: '',
    isActive: true,
  });

  // Stats drawer
  const [statsSupplier, setStatsSupplier] = useState<Supplier | null>(null);
  const [stats, setStats] = useState<SupplierStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fix useRef usage — we need it for search timer
  // Using a module-level ref approach instead
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Load suppliers ──────────────────────────────────────────────────────────

  const loadSuppliers = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tenantId: TENANT_ID,
        page: String(pageNum),
        limit: '20',
      });
      if (search.trim()) params.set('search', search.trim());
      if (isActiveFilter !== 'all') params.set('isActive', isActiveFilter);

      const res = await fetch(`${API_BASE}/api/suppliers?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: SuppliersList = await res.json();
      setSuppliers(data.suppliers);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load suppliers.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search, isActiveFilter]);

  useEffect(() => {
    loadSuppliers(1);
  }, [loadSuppliers]);

  // ─── Search ──────────────────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearch(value);
    const timer = setTimeout(() => loadSuppliers(1), 500);
    return () => clearTimeout(timer);
  };

  // Use a ref for the timer
  let timer: ReturnType<typeof setTimeout> | null = null;

  const onSearchChange = (value: string) => {
    setSearch(value);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => loadSuppliers(1), 500);
  };

  // ─── Open add sheet ─────────────────────────────────────────────────────────

  const openAddSheet = () => {
    setEditingSupplier(null);
    setForm({
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: '',
      contactPerson: '',
      paymentTerms: '',
      isActive: true,
    });
    setSheetOpen(true);
  };

  // ─── Open edit sheet ─────────────────────────────────────────────────────────

  const openEditSheet = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      city: supplier.city || '',
      country: supplier.country || '',
      contactPerson: supplier.contactPerson || '',
      paymentTerms: supplier.paymentTerms || '',
      isActive: supplier.isActive,
    });
    setSheetOpen(true);
  };

  // ─── Submit form ─────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      showToast('error', 'Supplier name is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        contactPerson: form.contactPerson.trim() || null,
        paymentTerms: form.paymentTerms.trim() || null,
        isActive: form.isActive,
      };

      const url = editingSupplier
        ? `${API_BASE}/api/suppliers/${editingSupplier.id}?tenantId=${TENANT_ID}`
        : `${API_BASE}/api/suppliers?tenantId=${TENANT_ID}`;
      const method = editingSupplier ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      showToast('success', editingSupplier ? 'Supplier updated.' : 'Supplier created.');
      setSheetOpen(false);
      loadSuppliers(page);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save supplier.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/suppliers/${deleteId}?tenantId=${TENANT_ID}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Supplier deleted.');
      setDeleteId(null);
      loadSuppliers(page);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete supplier.';
      showToast('error', message);
    } finally {
      setDeleting(false);
    }
  };

  // ─── View stats ──────────────────────────────────────────────────────────────

  const openStats = async (supplier: Supplier) => {
    setStatsSupplier(supplier);
    setStatsLoading(true);
    setStats(null);
    try {
      const res = await fetch(`${API_BASE}/api/suppliers/${supplier.id}/stats`);
      if (res.ok) {
        const data: SupplierStats = await res.json();
        setStats(data);
      }
    } catch {
      showToast('error', 'Failed to load stats.');
    } finally {
      setStatsLoading(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Heading as="h2" className="text-2xl font-bold text-slate-900">Suppliers</Heading>
          <Text variant="muted" className="mt-1">Manage your supplier relationships and contact details</Text>
        </div>
        <Button onClick={openAddSheet}>+ Add Supplier</Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search suppliers by name…"
              className="w-full"
            />
          </div>
          <Select
            value={isActiveFilter}
            onChange={(e) => { setIsActiveFilter(e.target.value); }}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
            className="w-full sm:w-40"
          />
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => loadSuppliers(page)} className="ml-3 underline font-medium">Retry</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
              <div className="h-5 w-48 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-32 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="text-5xl mb-4">🚚</div>
            <Heading as="h3" className="text-lg font-semibold text-slate-900">No suppliers found</Heading>
            <Text variant="muted" className="mt-2">Add your first supplier to start managing procurement.</Text>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Payment Terms</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{s.name}</p>
                      {s.contactPerson && <p className="text-xs text-slate-500">{s.contactPerson}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {s.email && <p>{s.email}</p>}
                      {s.phone && <p>{s.phone}</p>}
                      {!s.email && !s.phone && <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {s.city}{s.country ? `, ${s.country}` : ''}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{s.paymentTerms || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openStats(s)} title="Stats">
                          📊
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEditSheet(s)} title="Edit">
                          ✏️
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteId(s.id)} title="Delete" className="text-red-600 hover:text-red-700">
                          🗑
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <Text variant="muted" className="text-xs">
                Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total} suppliers
              </Text>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadSuppliers(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >
                  ← Previous
                </button>
                <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                <button
                  onClick={() => loadSuppliers(page + 1)}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ─── Add/Edit Sheet ─────────────────────────────────────────────────── */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        side="right"
        title={editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
      >
        <div className="space-y-4">
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Supplier name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="block text-sm font-medium text-slate-700 mb-1">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contact@supplier.com"
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-slate-700 mb-1">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Address</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Street address"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="block text-sm font-medium text-slate-700 mb-1">City</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="City"
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-slate-700 mb-1">Country</Label>
              <Input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="Country"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</Label>
              <Input
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</Label>
              <Input
                value={form.paymentTerms}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                placeholder="e.g. Net 30"
              />
            </div>
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Status</Label>
            <Select
              value={form.isActive ? 'true' : 'false'}
              onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}
              options={[
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSubmit} disabled={saving} className="flex-1">
              {saving ? 'Saving…' : editingSupplier ? 'Update Supplier' : 'Add Supplier'}
            </Button>
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      </Sheet>

      {/* ─── Stats Sheet ────────────────────────────────────────────────────── */}
      {statsSupplier && (
        <Sheet
          open={!!statsSupplier}
          onClose={() => { setStatsSupplier(null); setStats(null); }}
          side="right"
          title={`${statsSupplier.name} — Stats`}
        >
          {statsLoading ? (
            <div className="py-8 text-center text-slate-400">Loading stats…</div>
          ) : stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4">
                  <Text variant="muted" className="text-xs">Total Orders</Text>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalOrders}</p>
                </Card>
                <Card className="p-4">
                  <Text variant="muted" className="text-xs">Pending</Text>
                  <p className="text-2xl font-bold text-amber-700 mt-1">{stats.pendingOrders}</p>
                </Card>
                <Card className="p-4">
                  <Text variant="muted" className="text-xs">Received</Text>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.receivedOrders}</p>
                </Card>
                <Card className="p-4">
                  <Text variant="muted" className="text-xs">Cancelled</Text>
                  <p className="text-2xl font-bold text-red-700 mt-1">{stats.cancelledOrders}</p>
                </Card>
              </div>
              <Card className="p-4">
                <Text variant="muted" className="text-xs">Total Spend</Text>
                <p className="text-2xl font-bold text-indigo-700 mt-1">{formatCurrency(stats.totalSpend)}</p>
              </Card>
              {stats.avgDeliveryDays !== null && (
                <Card className="p-4">
                  <Text variant="muted" className="text-xs">Avg Delivery Variance</Text>
                  <p className="text-lg font-semibold text-slate-700 mt-1">
                    {stats.avgDeliveryDays > 0 ? `${stats.avgDeliveryDays}d late` : stats.avgDeliveryDays < 0 ? `${Math.abs(stats.avgDeliveryDays)}d early` : 'On time'}
                  </p>
                </Card>
              )}
              {stats.avgDeliveryDays === null && (
                <Text variant="muted" className="text-sm">No delivery data yet. Receive a PO to see delivery stats.</Text>
              )}
            </div>
          ) : null}
        </Sheet>
      )}

      {/* ─── Delete Confirmation ─────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <Heading as="h3" className="text-lg font-semibold text-slate-900">Delete Supplier?</Heading>
            <Text variant="muted" className="mt-2">
              This action cannot be undone. Suppliers with active purchase orders cannot be deleted.
            </Text>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
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
    </div>
  );
}
