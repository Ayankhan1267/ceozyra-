'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Heading, Text, Badge, Button, Card, Input } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Status config ─────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
] as const;

const STATUS_COLORS: Record<string, 'success' | 'danger' | 'neutral' | 'warning' | 'info' | 'default'> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  REFUNDED: 'neutral',
  CONFIRMED: 'info',
};

// Allowed transitions per current status
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['COMPLETED', 'REFUNDED'],
  COMPLETED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

// Quick action labels for each target status
const ACTION_LABELS: Record<string, { label: string; method: 'status' | 'ship' | 'deliver' | 'complete' | 'cancel' }> = {
  CONFIRMED: { label: 'Confirm', method: 'status' },
  PROCESSING: { label: 'Process', method: 'status' },
  SHIPPED: { label: 'Ship', method: 'ship' },
  DELIVERED: { label: 'Deliver', method: 'deliver' },
  COMPLETED: { label: 'Complete', method: 'complete' },
  CANCELLED: { label: 'Cancel', method: 'cancel' },
};

// ─── Types ─────────────────────────────────────────────────────────────────────

type OrderItem = {
  id: string;
  productId: string;
  name: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  price: number;
  total: number;
  product?: { name: string; images?: string[] } | null;
  variant?: { name: string } | null;
};

type Payment = {
  id: string;
  status: string;
  amount: number;
  method: string;
  transactionId?: string | null;
  paidAt?: string | null;
  createdAt: string;
};

type Shipment = {
  id: string;
  status: string;
  trackingNumber: string | null;
  carrier?: string | null;
  trackingUrl?: string | null;
  estimatedDelivery?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
};

type Refund = {
  id: string;
  amount: number;
  reason: string;
  status: string;
  transactionId?: string | null;
  createdAt: string;
};

type Customer = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone?: string | null;
};

type Address = Record<string, unknown>;

type OrderListItem = {
  id: string;
  orderNumber: string;
  customerId: string;
  status: string;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  customerId: string;
  customer?: Customer;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  shippingAddress: Address | null;
  billingAddress: Address | null;
  notes: string | null;
  items: OrderItem[];
  payments: Payment[];
  shipments: Shipment[];
  refunds: Refund[];
  createdAt: string;
  updatedAt: string;
};

type PaginatedOrders = {
  orders: OrderListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const getCustomerName = (c?: Customer | null) =>
  c ? `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email : null;

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  // List state
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Detail modal
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Action forms
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [shipForm, setShipForm] = useState({ carrier: '', trackingNumber: '', trackingUrl: '', estimatedDelivery: '' });
  const [showShipForm, setShowShipForm] = useState(false);

  // Mutations
  const [updating, setUpdating] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Load orders ─────────────────────────────────────────────────────────────

  const loadOrders = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenantId: TENANT_ID, page: String(pageNum), limit: String(limit) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`${API_BASE}/api/orders?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: PaginatedOrders = await res.json();
      setOrders(data.orders || []);
      setPage(data.page || pageNum);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load orders.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, startDate, endDate, limit]);

  useEffect(() => {
    loadOrders(1);
  }, [loadOrders]);

  // ─── Search (debounced) ──────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) {
      loadOrders(1);
      return;
    }
    searchTimer.current = setTimeout(() => doSearch(value), 500);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      doSearch(search);
    }
  };

  const doSearch = async (query: string) => {
    if (!query.trim()) {
      loadOrders(1);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/orders?${new URLSearchParams({ tenantId: TENANT_ID, limit: '50', status: statusFilter !== 'all' ? statusFilter : '' })}`);
      // Fetch all filtered orders and do client-side search for order number or customer name
      const data: PaginatedOrders = await res.json();
      const q = query.toLowerCase();
      const filtered = (data.orders || []).filter((o) => {
        const on = o.orderNumber.toLowerCase().includes(q);
        const oid = o.id.toLowerCase().includes(q);
        // We'll match customer name if we have it, otherwise skip
        return on || oid;
      });
      setOrders(filtered);
      setTotalPages(1);
      setTotal(filtered.length);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // ─── Open detail ─────────────────────────────────────────────────────────────

  const openDetail = async (orderId: string) => {
    setLoadingDetail(true);
    setSelectedOrder(null);
    setShowCancelForm(false);
    setShowShipForm(false);
    setCancelReason('');
    setShipForm({ carrier: '', trackingNumber: '', trackingUrl: '', estimatedDelivery: '' });
    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}`);
      if (!res.ok) throw new Error('Failed to load order detail');
      const data: OrderDetail = await res.json();
      setSelectedOrder(data);
    } catch {
      showToast('error', 'Failed to load order details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedOrder(null);
    setShowCancelForm(false);
    setShowShipForm(false);
    setCancelReason('');
    setShipForm({ carrier: '', trackingNumber: '', trackingUrl: '', estimatedDelivery: '' });
  };

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const updateOrderState = (updated: OrderDetail) => {
    setSelectedOrder(updated);
    setOrders((prev) =>
      prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status, total: updated.total } : o)),
    );
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedOrder) return;
    setUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders/${selectedOrder.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, tenantId: TENANT_ID }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: OrderDetail = await res.json();
      updateOrderState(data);
      showToast('success', `Order status changed to ${newStatus}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update status.';
      showToast('error', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleShip = async () => {
    if (!selectedOrder || !shipForm.trackingNumber.trim()) {
      showToast('error', 'Tracking number is required.');
      return;
    }
    setUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders/${selectedOrder.id}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier: shipForm.carrier || undefined,
          trackingNumber: shipForm.trackingNumber,
          trackingUrl: shipForm.trackingUrl || undefined,
          estimatedDelivery: shipForm.estimatedDelivery || undefined,
          tenantId: TENANT_ID,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: OrderDetail = await res.json();
      updateOrderState(data);
      setShowShipForm(false);
      setShipForm({ carrier: '', trackingNumber: '', trackingUrl: '', estimatedDelivery: '' });
      showToast('success', 'Order marked as shipped.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to ship order.';
      showToast('error', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeliver = async () => {
    if (!selectedOrder) return;
    setUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders/${selectedOrder.id}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: OrderDetail = await res.json();
      updateOrderState(data);
      showToast('success', 'Order marked as delivered.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark as delivered.';
      showToast('error', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedOrder) return;
    setUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders/${selectedOrder.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: OrderDetail = await res.json();
      updateOrderState(data);
      showToast('success', 'Order marked as completed.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to complete order.';
      showToast('error', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedOrder || !cancelReason.trim()) {
      showToast('error', 'Cancellation reason is required.');
      return;
    }
    setUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders/${selectedOrder.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason, tenantId: TENANT_ID }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: OrderDetail = await res.json();
      updateOrderState(data);
      setShowCancelForm(false);
      setCancelReason('');
      showToast('success', 'Order cancelled.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel order.';
      showToast('error', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleRefreshDetail = async () => {
    if (!selectedOrder) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/${selectedOrder.id}`);
      if (res.ok) {
        const data: OrderDetail = await res.json();
        setSelectedOrder(data);
      }
    } catch {
      // silently ignore
    }
  };

  // ─── Address render ──────────────────────────────────────────────────────────

  const renderAddress = (addr: Address | null, label: string) => {
    if (!addr || Object.keys(addr).length === 0) return <Text variant="muted" className="text-xs">—</Text>;
    const lines = Object.entries(addr)
      .filter(([, v]) => v != null && String(v).trim() !== '')
      .map(([k, v]) => <div key={k}><span className="text-slate-500 capitalize">{k}: </span>{String(v)}</div>);
    return <div className="text-xs text-slate-600 space-y-0.5">{lines}</div>;
  };

  // ─── Allowed actions for current status ──────────────────────────────────────

  const allowedActions = selectedOrder
    ? (ALLOWED_TRANSITIONS[selectedOrder.status] || []).filter(
        (s) => ACTION_LABELS[s],
      )
    : [];

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Heading as="h2" className="text-2xl font-bold text-slate-900">Orders</Heading>
            <Text variant="muted" className="mt-1">Manage and track customer orders</Text>
          </div>
          <Text variant="muted" className="text-xs">
            {total > 0 && `${total} total`}
          </Text>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col gap-3">
            {/* Search + status filter row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search by order number or ID…"
                  className="w-full"
                />
              </div>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
                <button
                  onClick={() => { setStatusFilter('all'); setPage(1); }}
                  className={[
                    'px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap',
                    statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  All
                </button>
                {ORDER_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setPage(1); }}
                    className={[
                      'px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap',
                      statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {s}
                  </button>
                ))}
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
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
                  className="text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Clear dates
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => loadOrders(page)} className="ml-3 underline font-medium">Retry</button>
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

        {/* Orders table */}
        {!loading && !error && (
          orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl">📦</div>
              <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">No orders found</Heading>
              <Text variant="muted" className="mt-2">Orders will appear here once customers make purchases.</Text>
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Order</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Customer</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Items</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Total</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-slate-900">{order.orderNumber}</p>
                            <p className="text-xs text-slate-500 mt-0.5">ID: {order.id.slice(0, 12)}…</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {order.customerId.slice(0, 12)}…
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(order.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_COLORS[order.status] || 'neutral'}>{order.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {order.items?.length ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatCurrency(Number(order.total), order.currency)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button size="sm" variant="outline" onClick={() => openDetail(order.id)}>
                            View
                          </Button>
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
                    Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} orders
                  </Text>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadOrders(page - 1)}
                      disabled={page <= 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                      ← Previous
                    </button>
                    <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => loadOrders(page + 1)}
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

      {/* ─── Order Detail Modal ─────────────────────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeDetail}>
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              {/* Modal header */}
              <div className="flex items-start justify-between">
                <div>
                  <Heading as="h3" className="text-lg font-semibold">Order {selectedOrder.orderNumber}</Heading>
                  <Text variant="muted" className="mt-0.5">Placed on {formatDateTime(selectedOrder.createdAt)}</Text>
                </div>
                <button onClick={closeDetail} className="text-slate-400 hover:text-slate-600 text-xl leading-none shrink-0 ml-4">&times;</button>
              </div>

              {loadingDetail ? (
                <div className="mt-6 space-y-3">
                  <div className="animate-pulse h-4 w-48 rounded bg-slate-200" />
                  <div className="animate-pulse h-4 w-32 rounded bg-slate-200" />
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {/* Status + Customer row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Status card */}
                    <Card className="p-4 bg-slate-50/50">
                      <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status</Text>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <Badge variant={STATUS_COLORS[selectedOrder.status] || 'neutral'}>{selectedOrder.status}</Badge>

                        {/* Quick actions for current status */}
                        {allowedActions.length > 0 && !showCancelForm && !showShipForm && (
                          <span className="flex flex-wrap gap-1.5 ml-1">
                            {allowedActions.map((targetStatus) => {
                              const action = ACTION_LABELS[targetStatus];
                              if (action.method === 'cancel') {
                                return (
                                  <button
                                    key={targetStatus}
                                    onClick={() => setShowCancelForm(true)}
                                    className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-700 hover:bg-red-50 font-medium transition-colors"
                                  >
                                    {action.label}
                                  </button>
                                );
                              }
                              if (action.method === 'ship') {
                                return (
                                  <button
                                    key={targetStatus}
                                    onClick={() => setShowShipForm(true)}
                                    className="text-xs px-2.5 py-1 rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-medium transition-colors"
                                  >
                                    {action.label}
                                  </button>
                                );
                              }
                              return (
                                <button
                                  key={targetStatus}
                                  onClick={() => handleStatusChange(targetStatus)}
                                  disabled={updating}
                                  className="text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium transition-colors disabled:opacity-50"
                                >
                                  {action.label}
                                </button>
                              );
                            })}
                          </span>
                        )}
                      </div>

                      {/* Cancel form */}
                      {showCancelForm && (
                        <div className="mt-3 space-y-2">
                          <Text className="text-xs text-red-600 font-medium">Cancellation reason required:</Text>
                          <textarea
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            rows={2}
                            placeholder="Reason for cancellation…"
                            className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="destructive" onClick={handleCancel} disabled={updating}>
                              {updating ? 'Cancelling…' : 'Confirm Cancel'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setShowCancelForm(false); setCancelReason(''); }}>
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Ship form */}
                      {showShipForm && (
                        <div className="mt-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">Carrier</label>
                              <Input
                                value={shipForm.carrier}
                                onChange={(e) => setShipForm({ ...shipForm, carrier: e.target.value })}
                                placeholder="e.g. FedEx"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">Tracking Number *</label>
                              <Input
                                value={shipForm.trackingNumber}
                                onChange={(e) => setShipForm({ ...shipForm, trackingNumber: e.target.value })}
                                placeholder="Tracking #"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">Tracking URL</label>
                              <Input
                                value={shipForm.trackingUrl}
                                onChange={(e) => setShipForm({ ...shipForm, trackingUrl: e.target.value })}
                                placeholder="https://…"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-0.5">Estimated Delivery</label>
                              <Input
                                type="date"
                                value={shipForm.estimatedDelivery}
                                onChange={(e) => setShipForm({ ...shipForm, estimatedDelivery: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleShip} disabled={updating}>
                              {updating ? 'Shipping…' : 'Confirm Ship'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setShowShipForm(false); setShipForm({ carrier: '', trackingNumber: '', trackingUrl: '', estimatedDelivery: '' }); }}>
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>

                    {/* Customer card */}
                    <Card className="p-4 bg-slate-50/50">
                      <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</Text>
                      {selectedOrder.customer ? (
                        <div className="mt-1.5 text-sm text-slate-900 space-y-0.5">
                          <p className="font-medium">{getCustomerName(selectedOrder.customer)}</p>
                          <p className="text-slate-600">{selectedOrder.customer.email}</p>
                          {selectedOrder.customer.phone && (
                            <p className="text-slate-600">{selectedOrder.customer.phone}</p>
                          )}
                        </div>
                      ) : (
                        <Text variant="muted" className="mt-1 text-xs">Customer: {selectedOrder.customerId.slice(0, 12)}…</Text>
                      )}
                    </Card>
                  </div>

                  {/* Items */}
                  <div>
                    <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Items</Heading>
                    <div className="mt-3 rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Product</th>
                            <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500">Qty</th>
                            <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">Unit Price</th>
                            <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedOrder.items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-3">
                                <p className="text-slate-900 font-medium">{item.name || 'Product'}</p>
                                <p className="text-xs text-slate-500">
                                  {item.variant?.name ? `${item.variant.name}` : ''}
                                  {item.variant?.name && item.productId ? ' · ' : ''}
                                  ID: {item.productId.slice(0, 10)}…
                                </p>
                              </td>
                              <td className="px-4 py-3 text-center text-slate-600">{item.quantity}</td>
                              <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(Number(item.unitPrice))}</td>
                              <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(Number(item.total))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-full max-w-xs space-y-1.5 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal</span><span>{formatCurrency(Number(selectedOrder.subtotal))}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Tax</span><span>{formatCurrency(Number(selectedOrder.tax))}</span>
                      </div>
                      {Number(selectedOrder.shipping) > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Shipping</span><span>{formatCurrency(Number(selectedOrder.shipping))}</span>
                        </div>
                      )}
                      {Number(selectedOrder.discount) > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Discount</span><span>-{formatCurrency(Number(selectedOrder.discount))}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                        <span>Total</span><span>{formatCurrency(Number(selectedOrder.total), selectedOrder.currency)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment + Shipment + Refunds */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Payments */}
                    <Card className="p-4">
                      <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Payments</Text>
                      {selectedOrder.payments.length === 0 ? (
                        <Text variant="muted" className="mt-2 text-xs">No payments recorded.</Text>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {selectedOrder.payments.map((p) => (
                            <div key={p.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-900">{formatCurrency(Number(p.amount))}</span>
                                <Badge variant={p.status === 'SUCCEEDED' ? 'success' : p.status === 'FAILED' ? 'danger' : 'warning'}>
                                  {p.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {p.method}
                                {p.transactionId && ` · ${p.transactionId}`}
                              </p>
                              {p.paidAt && (
                                <p className="text-xs text-slate-400 mt-0.5">Paid {formatDateTime(p.paidAt)}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                    {/* Shipments */}
                    <Card className="p-4">
                      <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Shipments</Text>
                      {selectedOrder.shipments.length === 0 ? (
                        <Text variant="muted" className="mt-2 text-xs">No shipments yet.</Text>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {selectedOrder.shipments.map((s) => (
                            <div key={s.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-900">{s.carrier || 'Shipment'}</span>
                                <Badge variant={s.status === 'DELIVERED' ? 'success' : s.status === 'IN_TRANSIT' ? 'info' : 'warning'}>
                                  {s.status}
                                </Badge>
                              </div>
                              {s.trackingNumber && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                  Tracking: {s.trackingNumber}
                                  {s.trackingUrl && (
                                    <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline ml-1">Track →</a>
                                  )}
                                </p>
                              )}
                              {s.estimatedDelivery && (
                                <p className="text-xs text-slate-400 mt-0.5">Est. {formatDate(s.estimatedDelivery)}</p>
                              )}
                              {s.deliveredAt && (
                                <p className="text-xs text-slate-400 mt-0.5">Delivered {formatDateTime(s.deliveredAt)}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                    {/* Refunds */}
                    <Card className="p-4">
                      <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Refunds</Text>
                      {selectedOrder.refunds.length === 0 ? (
                        <Text variant="muted" className="mt-2 text-xs">No refunds.</Text>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {selectedOrder.refunds.map((r) => (
                            <div key={r.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-900">-{formatCurrency(Number(r.amount))}</span>
                                <Badge variant={r.status === 'SUCCEEDED' ? 'success' : 'warning'}>
                                  {r.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">{r.reason}</p>
                              {r.transactionId && (
                                <p className="text-xs text-slate-400 mt-0.5">TXN: {r.transactionId}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>

                  {/* Addresses */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="p-4">
                      <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Shipping Address</Text>
                      <div className="mt-2">{renderAddress(selectedOrder.shippingAddress, 'shipping')}</div>
                    </Card>
                    <Card className="p-4">
                      <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Billing Address</Text>
                      <div className="mt-2">{renderAddress(selectedOrder.billingAddress, 'billing')}</div>
                    </Card>
                  </div>

                  {/* Notes */}
                  {selectedOrder.notes && (
                    <Card className="p-4">
                      <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Notes</Text>
                      <pre className="mt-2 text-xs text-slate-600 whitespace-pre-wrap font-sans">{selectedOrder.notes}</pre>
                    </Card>
                  )}

                  {/* Modal footer */}
                  <div className="flex justify-end pt-2">
                    <Button variant="outline" onClick={closeDetail}>Close</Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

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
