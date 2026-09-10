'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Heading, Text, Badge, Button, Card, Input, Sheet, Avatar } from '@zyra/ui';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  dateOfBirth: string | null;
  address: Record<string, unknown> | null;
  segment: string;
  source: string;
  health: string;
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type PaginatedCustomers = {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    totalCustomers: number;
    activeCustomers: number;
    totalRevenue: number;
    avgOrderValue: number;
  };
};

type Tag = { id: string; name: string; color: string };

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  segment: 'new',
  source: 'website',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getFullName = (c: Customer) => `${c.firstName} ${c.lastName}`.trim() || c.email;

const getInitials = (c: Customer) => {
  const f = c.firstName?.[0] || '';
  const l = c.lastName?.[0] || '';
  return (f + l).toUpperCase() || c.email[0]?.toUpperCase() || '?';
};

const SEGMENT_COLORS: Record<string, 'success' | 'warning' | 'info' | 'neutral' | 'default' | 'danger'> = {
  vip: 'success',
  premium: 'info',
  regular: 'default',
  new: 'neutral',
  at_risk: 'warning',
  churned: 'danger',
};

const HEALTH_COLORS: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'default' | 'info'> = {
  healthy: 'success',
  at_risk: 'warning',
  inactive: 'danger',
  new: 'info',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const router = useRouter();

  // Customers list state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Add customer sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Toast helper ─────────────────────────────────────────────────────────────

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Fetch tags ──────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/tags?tenantId=${TENANT_ID}`);
        if (res.ok) {
          const data = await res.json();
          setAvailableTags(Array.isArray(data) ? data : data.tags || []);
        }
      } catch { /* silently ignore */ }
    })();
  }, []);

  // ─── Load customers ──────────────────────────────────────────────────────────

  const loadCustomers = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tenantId: TENANT_ID,
        page: String(pageNum),
        limit: String(limit),
      });
      if (search.trim()) params.set('search', search.trim());
      if (segmentFilter !== 'all') params.set('segment', segmentFilter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (tagFilter !== 'all') params.set('tagId', tagFilter);

      const res = await fetch(`${API_BASE}/api/customers?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: PaginatedCustomers = await res.json();
      setCustomers(data.customers || []);
      setPage(data.page || pageNum);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load customers.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search, segmentFilter, sourceFilter, startDate, endDate, tagFilter, limit]);

  useEffect(() => {
    loadCustomers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentFilter, sourceFilter, startDate, endDate, tagFilter]);

  // ─── Search (debounced) ──────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) {
      loadCustomers(1);
      return;
    }
    searchTimer.current = setTimeout(() => loadCustomers(1), 500);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      loadCustomers(1);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setSegmentFilter('all');
    setSourceFilter('all');
    setStartDate('');
    setEndDate('');
    setTagFilter('all');
    setPage(1);
  };

  const hasActiveFilters = search || segmentFilter !== 'all' || sourceFilter !== 'all' || startDate || endDate || tagFilter !== 'all';

  // ─── Create customer ─────────────────────────────────────────────────────────

  const openCreateSheet = () => {
    setForm(emptyForm);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setForm(emptyForm);
  };

  const handleCreate = async () => {
    if (!form.firstName.trim() && !form.lastName.trim()) {
      showToast('error', 'First name or last name is required.');
      return;
    }
    if (!form.email.trim()) {
      showToast('error', 'Email is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tenantId: TENANT_ID,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        segment: form.segment,
        source: form.source,
      };

      const res = await fetch(`${API_BASE}/api/customers?tenantId=${TENANT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      showToast('success', 'Customer created successfully.');
      closeSheet();
      loadCustomers(page);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create customer.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete customer ─────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/customers/${deleteConfirm}?tenantId=${TENANT_ID}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Customer deleted.');
      setDeleteConfirm(null);
      loadCustomers(page);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete customer.';
      showToast('error', message);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Navigate to detail ──────────────────────────────────────────────────────

  const viewCustomer = (id: string) => {
    router.push(`/dashboard/customers/${id}`);
  };

  // ─── Segment options ─────────────────────────────────────────────────────────

  const segmentOptions = [
    { value: 'all', label: 'All Segments' },
    { value: 'vip', label: 'VIP' },
    { value: 'premium', label: 'Premium' },
    { value: 'regular', label: 'Regular' },
    { value: 'new', label: 'New' },
    { value: 'at_risk', label: 'At Risk' },
    { value: 'churned', label: 'Churned' },
  ];

  const sourceOptions = [
    { value: 'all', label: 'All Sources' },
    { value: 'website', label: 'Website' },
    { value: 'referral', label: 'Referral' },
    { value: 'social_media', label: 'Social Media' },
    { value: 'email', label: 'Email' },
    { value: 'walk_in', label: 'Walk-in' },
    { value: 'other', label: 'Other' },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Heading as="h2" className="text-2xl font-bold text-slate-900">Customers</Heading>
            <Text variant="muted" className="mt-1">Manage your customer relationships</Text>
          </div>
          <Button onClick={openCreateSheet}>+ Add Customer</Button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Total Customers</Text>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalCustomers}</p>
          </Card>
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Active Customers</Text>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stats.activeCustomers}</p>
          </Card>
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Total Revenue</Text>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(stats.totalRevenue)}</p>
          </Card>
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Avg Order Value</Text>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(stats.avgOrderValue)}</p>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col gap-3">
            {/* Search + segment/source filter row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Input
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search by name, email, or phone…"
                  className="w-full"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={segmentFilter}
                  onChange={(e) => { setSegmentFilter(e.target.value); setPage(1); }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {segmentOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <select
                  value={sourceFilter}
                  onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {sourceOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {availableTags.length > 0 && (
                  <select
                    value={tagFilter}
                    onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="all">All Tags</option>
                    {availableTags.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            {/* Date range row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500 shrink-0">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500 shrink-0">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => loadCustomers(page)} className="ml-3 underline font-medium">Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
                <div className="h-5 w-48 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-32 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        )}

        {/* Customers table */}
        {!loading && !error && (
          customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl">👥</div>
              <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">No customers found</Heading>
              <Text variant="muted" className="mt-2">
                {hasActiveFilters ? 'Try adjusting your filters or search term.' : 'Add your first customer to get started.'}
              </Text>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-3 underline text-indigo-600 text-sm">Clear filters</button>
              )}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Customer</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Segment</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Source</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Orders</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Total Spent</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Last Order</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => viewCustomer(customer.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={customer.avatar || undefined}
                              alt={getFullName(customer)}
                              initials={getInitials(customer)}
                              size="sm"
                            />
                            <div>
                              <p className="font-medium text-slate-900">{getFullName(customer)}</p>
                              <p className="text-xs text-slate-500">{customer.email}</p>
                              {customer.phone && <p className="text-xs text-slate-400">{customer.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={SEGMENT_COLORS[customer.segment] || 'default'}>{customer.segment}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs capitalize">
                          {customer.source?.replace(/_/g, ' ') || '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{customer.totalOrders}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatCurrency(customer.totalSpent)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {formatDate(customer.lastOrderDate)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); viewCustomer(customer.id); }}
                            >
                              View
                            </Button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(customer.id); }}
                              className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
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
                    Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} customers
                  </Text>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadCustomers(page - 1)}
                      disabled={page <= 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                      ← Previous
                    </button>
                    <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => loadCustomers(page + 1)}
                      disabled={page >= totalPages}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )
        )}
      </div>

      {/* ─── Add Customer Sheet ──────────────────────────────────────────────── */}
      {sheetOpen && (
        <Sheet open={sheetOpen} onClose={closeSheet} title="Add Customer" side="right">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Last name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 234 567 8900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Segment</label>
              <select
                value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="new">New</option>
                <option value="regular">Regular</option>
                <option value="premium">Premium</option>
                <option value="vip">VIP</option>
                <option value="at_risk">At Risk</option>
                <option value="churned">Churned</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="social_media">Social Media</option>
                <option value="email">Email</option>
                <option value="walk_in">Walk-in</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={closeSheet} disabled={saving}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating…' : 'Create Customer'}
              </Button>
            </div>
          </div>
        </Sheet>
      )}

      {/* ─── Delete Confirmation ─────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <Heading as="h3" className="text-lg font-semibold text-slate-900">Delete Customer?</Heading>
            <Text variant="muted" className="mt-2">
              This action cannot be undone. The customer and all related data will be permanently removed.
            </Text>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</Button>
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
    </>
  );
}
