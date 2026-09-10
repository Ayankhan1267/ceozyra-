'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Heading, Text, Badge, Button, Card, Input, Label, Select, Sheet, Tabs, TabPanel } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Segment = {
  id: string;
  name: string;
  description: string | null;
  rules: Record<string, unknown> | null;
  customerIds: string[];
  customerCount: number;
  isDynamic: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
};

type PaginatedSegments = {
  segments: Segment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type SegmentDetail = {
  id: string;
  name: string;
  description: string | null;
  rules: Record<string, unknown> | null;
  customerIds: string[];
  customerCount: number;
  isDynamic: boolean;
  color: string;
  customers?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGMENT_COLORS = [
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-500' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'amber', label: 'Amber', class: 'bg-amber-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function getSegmentColorClass(color: string): string {
  const found = SEGMENT_COLORS.find((c) => c.value === color);
  return found?.class || 'bg-slate-400';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SegmentsPage() {
  // Segments list
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);

  // Filters
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Add/Edit Sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    rules: '',
    isDynamic: false,
    color: 'indigo',
  });
  const [saving, setSaving] = useState(false);

  // Detail Sheet
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<SegmentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Evaluate
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Toast helper ────────────────────────────────────────────────────────────

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Load segments ──────────────────────────────────────────────────────────

  const loadSegments = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenantId: TENANT_ID, page: String(pageNum), limit: String(limit) });

      const res = await fetch(`${API_BASE}/api/segments?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: PaginatedSegments = await res.json();
      let filtered = data.segments || [];
      // Client-side search
      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter((s) => s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q));
      }
      setSegments(filtered);
      setPage(data.page || pageNum);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || filtered.length);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load segments.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [limit, search]);

  useEffect(() => {
    loadSegments(1);
  }, [loadSegments]);

  // ─── Search ──────────────────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) {
      loadSegments(1);
      return;
    }
    searchTimer.current = setTimeout(() => loadSegments(1), 500);
  };

  // ─── Open add sheet ─────────────────────────────────────────────────────────

  const openAddSheet = () => {
    setEditingSegment(null);
    setForm({
      name: '',
      description: '',
      rules: '',
      isDynamic: false,
      color: 'indigo',
    });
    setSheetOpen(true);
  };

  // ─── Open edit sheet ─────────────────────────────────────────────────────────

  const openEditSheet = (segment: Segment) => {
    setEditingSegment(segment);
    setForm({
      name: segment.name,
      description: segment.description || '',
      rules: segment.rules ? JSON.stringify(segment.rules, null, 2) : '',
      isDynamic: segment.isDynamic,
      color: segment.color,
    });
    setSheetOpen(true);
  };

  // ─── Submit segment form ─────────────────────────────────────────────────────

  const handleSegmentSubmit = async () => {
    if (!form.name.trim()) {
      showToast('error', 'Segment name is required.');
      return;
    }

    let parsedRules: Record<string, unknown> | null = null;
    if (form.rules.trim()) {
      try {
        parsedRules = JSON.parse(form.rules);
      } catch {
        showToast('error', 'Rules must be valid JSON.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        tenantId: TENANT_ID,
        name: form.name.trim(),
        description: form.description.trim() || null,
        rules: parsedRules,
        isDynamic: form.isDynamic,
        color: form.color,
      };

      const url = editingSegment
        ? `${API_BASE}/api/segments/${editingSegment.id}?tenantId=${TENANT_ID}`
        : `${API_BASE}/api/segments?tenantId=${TENANT_ID}`;

      const res = await fetch(url, {
        method: editingSegment ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      showToast('success', editingSegment ? 'Segment updated successfully.' : 'Segment created successfully.');
      setSheetOpen(false);
      loadSegments(page);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save segment.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Evaluate dynamic segment ────────────────────────────────────────────────

  const handleEvaluate = async (segment: Segment) => {
    if (!segment.isDynamic) return;
    setEvaluatingId(segment.id);
    try {
      const res = await fetch(`${API_BASE}/api/segments/${segment.id}/evaluate?tenantId=${TENANT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', `Segment evaluated. ${segment.customerCount} customers matched.`);
      loadSegments(page);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to evaluate segment.';
      showToast('error', message);
    } finally {
      setEvaluatingId(null);
    }
  };

  // ─── View segment detail ─────────────────────────────────────────────────────

  const openDetail = async (segment: Segment) => {
    setLoadingDetail(true);
    setSelectedSegment(null);
    try {
      const res = await fetch(`${API_BASE}/api/segments/${segment.id}?tenantId=${TENANT_ID}`);
      if (!res.ok) throw new Error('Failed to load segment detail');
      const data: SegmentDetail = await res.json();
      setSelectedSegment(data);
      setDetailOpen(true);
    } catch {
      showToast('error', 'Failed to load segment details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  // ─── Delete segment ──────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/segments/${deleteId}?tenantId=${TENANT_ID}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Segment deleted.');
      setDeleteId(null);
      loadSegments(page);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete segment.';
      showToast('error', message);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Heading as="h2" className="text-2xl font-bold text-slate-900">Segments</Heading>
            <Text variant="muted" className="mt-1">Organize customers into targeted groups</Text>
          </div>
          <Button onClick={openAddSheet}>+ Add Segment</Button>
        </div>

        {/* Info banner */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <span className="text-xl">ℹ️</span>
            <div>
              <Text className="text-sm font-medium text-blue-800">Static vs Dynamic Segments</Text>
              <Text variant="muted" className="text-xs mt-0.5 text-blue-600">
                <strong>Static</strong> segments contain a fixed list of customer IDs you manage manually.
                <strong> Dynamic</strong> segments use rules to automatically evaluate and include matching customers — click "Evaluate" to refresh.
              </Text>
            </div>
          </div>
        </Card>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search segments by name or description…"
                className="w-full"
              />
            </div>
          </div>
        </Card>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => loadSegments(page)} className="ml-3 underline font-medium">Retry</button>
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

        {/* Segments grid */}
        {!loading && !error && (
          segments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl">🎯</div>
              <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">No segments found</Heading>
              <Text variant="muted" className="mt-2">Create your first segment to start grouping customers.</Text>
              <Button className="mt-4" onClick={openAddSheet}>+ Add Segment</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {segments.map((segment) => (
                  <Card key={segment.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(segment)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full shrink-0 ${getSegmentColorClass(segment.color)}`} />
                        <Heading as="h4" className="text-sm font-semibold text-slate-900">{segment.name}</Heading>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {segment.isDynamic && (
                          <Badge variant="info">Dynamic</Badge>
                        )}
                        {!segment.isDynamic && (
                          <Badge variant="neutral">Static</Badge>
                        )}
                      </div>
                    </div>
                    {segment.description && (
                      <Text variant="muted" className="text-xs mt-2 line-clamp-2">{segment.description}</Text>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="default">{segment.customerCount} customers</Badge>
                      </div>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {segment.isDynamic && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEvaluate(segment)}
                            disabled={evaluatingId === segment.id}
                            className="text-xs"
                          >
                            {evaluatingId === segment.id ? 'Evaluating…' : 'Evaluate'}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEditSheet(segment)} className="text-xs">Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteId(segment.id)} className="text-xs text-red-600">Delete</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <Text variant="muted" className="text-xs">
                    Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} segments
                  </Text>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadSegments(page - 1)}
                      disabled={page <= 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                      ← Previous
                    </button>
                    <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => loadSegments(page + 1)}
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

      {/* ─── Add/Edit Segment Sheet ─────────────────────────────────────────── */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        side="right"
        title={editingSegment ? 'Edit Segment' : 'Create New Segment'}
      >
        <div className="space-y-4">
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. VIP Customers"
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Description</Label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Describe this segment…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">
              Rules (JSON) — {form.isDynamic ? 'required for dynamic segments' : 'optional'}
            </Label>
            <textarea
              value={form.rules}
              onChange={(e) => setForm({ ...form, rules: e.target.value })}
              rows={6}
              placeholder={`{\n  "minSpend": 1000,\n  "location": "US"\n}`}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <Text variant="muted" className="text-xs mt-1">Enter JSON rules for dynamic evaluation.</Text>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDynamic"
              checked={form.isDynamic}
              onChange={(e) => setForm({ ...form, isDynamic: e.target.checked })}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isDynamic" className="text-sm text-slate-700">Dynamic (rules-based)</label>
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Color</Label>
            <div className="flex flex-wrap gap-2">
              {SEGMENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm({ ...form, color: c.value })}
                  className={[
                    'h-8 w-8 rounded-full transition-all',
                    c.class,
                    form.color === c.value ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'opacity-70 hover:opacity-100',
                  ].join(' ')}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSegmentSubmit} disabled={saving} className="flex-1">
              {saving ? 'Saving…' : editingSegment ? 'Update Segment' : 'Create Segment'}
            </Button>
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      </Sheet>

      {/* ─── Segment Detail Sheet ───────────────────────────────────────────── */}
      {selectedSegment && (
        <Sheet
          open={detailOpen}
          onClose={() => { setDetailOpen(false); setSelectedSegment(null); }}
          side="right"
          title="Segment Details"
        >
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <span className={`h-4 w-4 rounded-full shrink-0 ${getSegmentColorClass(selectedSegment.color)}`} />
              <Heading as="h3" className="text-base font-semibold text-slate-900">{selectedSegment.name}</Heading>
            </div>

            <div className="flex gap-2">
              <Badge variant={selectedSegment.isDynamic ? 'info' : 'neutral'}>
                {selectedSegment.isDynamic ? 'Dynamic' : 'Static'}
              </Badge>
              <Badge variant="default">{selectedSegment.customerCount} customers</Badge>
            </div>

            {selectedSegment.description && (
              <div>
                <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Description</Text>
                <Text variant="muted" className="text-sm mt-1">{selectedSegment.description}</Text>
              </div>
            )}

            {selectedSegment.rules && (
              <div>
                <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rules</Text>
                <pre className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 overflow-x-auto font-mono">
                  {JSON.stringify(selectedSegment.rules, null, 2)}
                </pre>
              </div>
            )}

            {selectedSegment.isDynamic && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleEvaluate(selectedSegment as Segment)}
                disabled={evaluatingId === selectedSegment.id}
                className="w-full"
              >
                {evaluatingId === selectedSegment.id ? 'Evaluating…' : '🔄 Re-evaluate Segment'}
              </Button>
            )}

            {/* Customers list */}
            <div>
              <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Customers in this segment ({selectedSegment.customerCount})
              </Text>
              {selectedSegment.customers && selectedSegment.customers.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedSegment.customers.map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {customer.firstName} {customer.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{customer.email}</p>
                        {customer.phone && <p className="text-xs text-slate-400">{customer.phone}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Text variant="muted" className="text-xs">No customers in this segment yet.</Text>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-200">
              <Button size="sm" variant="outline" onClick={() => { setDetailOpen(false); openEditSheet(selectedSegment as Segment); }}>
                Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => { setDetailOpen(false); setDeleteId(selectedSegment.id); }}>
                Delete
              </Button>
            </div>
          </div>
        </Sheet>
      )}

      {/* ─── Delete Confirmation ─────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <Heading as="h3" className="text-lg font-semibold text-slate-900">Delete Segment?</Heading>
            <Text variant="muted" className="mt-2">
              This action cannot be undone. The segment will be permanently removed.
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
    </>
  );
}
