'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Heading, Text, Badge, Button, Card, Input, Label, Select, Sheet } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Types ──────────────────────────────────────────────────────────────────────

type PurchaseOrder = {
  id: string;
  tenantId: string;
  supplierId: string;
  supplier: { id: string; name: string };
  status: string;
  items: any[];
  totalAmount: number;
  expectedDelivery: string | null;
  receivedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type POsList = {
  purchaseOrders: PurchaseOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type Supplier = {
  id: string;
  name: string;
  isActive: boolean;
};

type POStats = {
  total: number;
  draft: number;
  ordered: number;
  received: number;
  cancelled: number;
  pending: number;
  totalSpend: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PO_STATUSES = ['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'] as const;

const PO_STATUS_COLORS: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  ORDERED: 'info',
  RECEIVED: 'success',
  CANCELLED: 'danger',
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

// ─── Component ────────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [stats, setStats] = useState<POStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Create PO modal
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [poForm, setPoForm] = useState({
    supplierId: '',
    items: [{ productId: '', variantId: '', quantity: 1, unitCost: 0 }],
    expectedDelivery: '',
    notes: '',
  });

  // Receive confirmation
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receiving, setReceiving] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Load suppliers for dropdown ─────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/suppliers?tenantId=${TENANT_ID}&limit=100`);
        if (res.ok) {
          const data = await res.json();
          setSuppliers(data.suppliers || []);
        }
      } catch { /* silently ignore */ }
    })();
  }, []);

  // ─── Load stats ─────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/purchase-orders/stats/tenant?tenantId=${TENANT_ID}`);
      if (res.ok) {
        const data: POStats = await res.json();
        setStats(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // ─── Load purchase orders ────────────────────────────────────────────────────

  const loadPOs = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tenantId: TENANT_ID,
        page: String(pageNum),
        limit: '20',
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`${API_BASE}/api/purchase-orders?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: POsList = await res.json();
      setPurchaseOrders(data.purchaseOrders);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load purchase orders.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadPOs(1);
  }, [loadPOs]);

  // ─── Create PO ──────────────────────────────────────────────────────────────

  const handleCreatePO = async () => {
    if (!poForm.supplierId || poForm.items.length === 0) return;

    setSaving(true);
    try {
      const payload = {
        tenantId: TENANT_ID,
        supplierId: poForm.supplierId,
        items: poForm.items,
        expectedDelivery: poForm.expectedDelivery || undefined,
        notes: poForm.notes.trim() || undefined,
      };

      const res = await fetch(`${API_BASE}/api/purchase-orders?tenantId=${TENANT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      showToast('success', 'Purchase order created.');
      setPoModalOpen(false);
      setPoForm({
        supplierId: '',
        items: [{ productId: '', variantId: '', quantity: 1, unitCost: 0 }],
        expectedDelivery: '',
        notes: '',
      });
      loadPOs(1);
      loadStats();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create PO.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Receive PO ─────────────────────────────────────────────────────────────

  const handleReceive = async (poId: string) => {
    setReceiving(true);
    try {
      const res = await fetch(`${API_BASE}/api/purchase-orders/${poId}/receive?tenantId=${TENANT_ID}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'PO received. Inventory updated.');
      setReceivingId(null);
      loadPOs(page);
      loadStats();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to receive PO.';
      showToast('error', message);
    } finally {
      setReceiving(false);
    }
  };

  // ─── Cancel PO ──────────────────────────────────────────────────────────────

  const handleCancel = async (poId: string) => {
    setReceiving(true);
    try {
      const res = await fetch(`${API_BASE}/api/purchase-orders/${poId}/cancel?tenantId=${TENANT_ID}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'PO cancelled.');
      setReceivingId(null);
      loadPOs(page);
      loadStats();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel PO.';
      showToast('error', message);
    } finally {
      setReceiving(false);
    }
  };

  // ─── Delete PO ──────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/purchase-orders/${deleteId}?tenantId=${TENANT_ID}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Purchase order deleted.');
      setDeleteId(null);
      loadPOs(page);
      loadStats();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete PO.';
      showToast('error', message);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Item helpers ────────────────────────────────────────────────────────────

  const updateItem = (index: number, field: string, value: string | number) => {
    const updated = [...poForm.items];
    (updated[index] as Record<string, unknown>)[field] = value;
    setPoForm({ ...poForm, items: updated });
  };

  const addItem = () => {
    setPoForm({ ...poForm, items: [...poForm.items, { productId: '', variantId: '', quantity: 1, unitCost: 0 }] });
  };

  const removeItem = (index: number) => {
    const updated = poForm.items.filter((_, i) => i !== index);
    setPoForm({ ...poForm, items: updated });
  };

  // ─── Compute PO total ────────────────────────────────────────────────────────

  const poTotal = poForm.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Heading as="h2" className="text-2xl font-bold text-slate-900">Purchase Orders</Heading>
          <Text variant="muted" className="mt-1">Create, track, and receive purchase orders from suppliers</Text>
        </div>
        <Button onClick={() => setPoModalOpen(true)}>+ New Purchase Order</Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total POs', value: stats.total, color: 'bg-indigo-50 text-indigo-700' },
            { label: 'Draft', value: stats.draft, color: 'bg-slate-100 text-slate-700' },
            { label: 'Ordered', value: stats.ordered, color: 'bg-blue-50 text-blue-700' },
            { label: 'Received', value: stats.received, color: 'bg-emerald-50 text-emerald-700' },
            { label: 'Cancelled', value: stats.cancelled, color: 'bg-red-50 text-red-700' },
            { label: 'Pending', value: stats.pending, color: 'bg-amber-50 text-amber-700' },
            { label: 'Total Spend', value: formatCurrency(stats.totalSpend), color: 'bg-violet-50 text-violet-700' },
          ].map((s) => (
            <Card key={s.label} className="p-3">
              <Text variant="muted" className="text-xs">{s.label}</Text>
              <p className={`text-lg font-bold mt-0.5 rounded-md px-1.5 py-0.5 inline-block ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Statuses' },
              ...PO_STATUSES.map((s) => ({ value: s, label: s })),
            ]}
            className="w-full sm:w-40"
          />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From date"
            className="w-full sm:w-44"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To date"
            className="w-full sm:w-44"
          />
          <Button variant="outline" size="sm" onClick={() => loadPOs(page)}>Apply</Button>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => loadPOs(page)} className="ml-3 underline font-medium">Retry</button>
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
      ) : purchaseOrders.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="text-5xl mb-4">📦</div>
            <Heading as="h3" className="text-lg font-semibold text-slate-900">No purchase orders</Heading>
            <Text variant="muted" className="mt-2">Create your first PO to start tracking inventory replenishment.</Text>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">PO ID</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Supplier</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Items</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Expected</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Created</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-500">{po.id.slice(-8)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{po.supplier.name}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 text-xs">
                      {po.items.length} item(s)
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(Number(po.totalAmount))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={PO_STATUS_COLORS[po.status] || 'neutral'}>{po.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {formatDate(po.expectedDelivery)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {formatDate(po.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {po.status === 'ORDERED' && (
                          <Button size="sm" variant="outline" onClick={() => setReceivingId(po.id)} disabled={receiving}>
                            Receive
                          </Button>
                        )}
                        {(po.status === 'DRAFT' || po.status === 'ORDERED') && (
                          <Button size="sm" variant="outline" onClick={() => handleCancel(po.id)} disabled={receiving}>
                            Cancel
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setDeleteId(po.id)} className="text-red-600 hover:text-red-700" title="Delete">
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
                Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total} purchase orders
              </Text>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadPOs(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >
                  ← Previous
                </button>
                <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                <button
                  onClick={() => loadPOs(page + 1)}
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

      {/* ─── Create PO Modal ───────────────────────────────────────────────── */}
      {poModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPoModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <Heading as="h3" className="mb-4">New Purchase Order</Heading>
            <div className="space-y-4">
              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-1">Supplier *</Label>
                <select
                  value={poForm.supplierId}
                  onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select a supplier</option>
                  {suppliers.filter((s) => s.isActive).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-2">Items</Label>
                {poForm.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 mb-2">
                    <div className="col-span-4">
                      <Input
                        placeholder="Product ID"
                        value={item.productId}
                        onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        placeholder="Unit Cost"
                        min={0}
                        step="0.01"
                        value={item.unitCost}
                        onChange={(e) => updateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-3 flex items-center gap-1">
                      <span className="text-xs text-slate-500 flex-1">{formatCurrency(item.quantity * item.unitCost)}</span>
                      {poForm.items.length > 1 && (
                        <Button size="sm" variant="ghost" onClick={() => removeItem(idx)} className="text-red-600">×</Button>
                      )}
                    </div>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={addItem}>+ Add Item</Button>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total</span>
                <span className="font-semibold text-slate-900">{formatCurrency(poTotal)}</span>
              </div>

              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-1">Expected Delivery</Label>
                <Input
                  type="date"
                  value={poForm.expectedDelivery}
                  onChange={(e) => setPoForm({ ...poForm, expectedDelivery: e.target.value })}
                />
              </div>

              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-1">Notes</Label>
                <textarea
                  value={poForm.notes}
                  onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Optional notes…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <Button variant="outline" onClick={() => setPoModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreatePO} disabled={saving || !poForm.supplierId}>
                {saving ? 'Creating…' : 'Create PO'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Receive Confirmation ──────────────────────────────────────────── */}
      {receivingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <Heading as="h3" className="text-lg font-semibold text-slate-900">Receive Purchase Order?</Heading>
            <Text variant="muted" className="mt-2">
              This will mark the PO as received and update inventory quantities for all items. This action cannot be undone.
            </Text>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setReceivingId(null)} disabled={receiving}>Cancel</Button>
              <Button onClick={() => handleReceive(receivingId)} disabled={receiving}>
                {receiving ? 'Processing…' : 'Confirm Receive'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Delete Confirmation ─────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <Heading as="h3" className="text-lg font-semibold text-slate-900">Delete Purchase Order?</Heading>
            <Text variant="muted" className="mt-2">
              This action cannot be undone. Only draft or cancelled POs can be deleted.
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
