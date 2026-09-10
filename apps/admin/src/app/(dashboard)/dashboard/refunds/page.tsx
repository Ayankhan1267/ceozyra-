'use client';

import { useState, useCallback, useEffect } from 'react';
import { Heading, Text, Badge, Button, Card, Input } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

const REFUND_STATUSES = ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'] as const;

const STATUS_COLORS: Record<string, 'success' | 'danger' | 'neutral' | 'warning' | 'info' | 'default'> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
};

type RefundListItem = {
  id: string;
  orderId: string;
  paymentId: string | null;
  amount: number;
  currency: string;
  reason: string | null;
  status: string;
  provider: string | null;
  transactionId: string | null;
  createdAt: string;
  refundedAt: string | null;
};

type RefundDetail = RefundListItem & {
  order?: { id: string; orderNumber: string; status: string };
  payment?: { id: string; method: string; transactionId: string | null };
};

type PaginatedRefunds = {
  refunds: RefundListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type RefundStats = {
  totalRefunded: number;
  refundCount: number;
  averageRefundAmount: number;
  periodStart: string | null;
  periodEnd: string | null;
};

const formatCurrency = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ─── Component ────────────────────────────────────────────────────────────────

export default function RefundsPage() {
  // List state
  const [refunds, setRefunds] = useState<RefundListItem[]>([]);
  const [stats, setStats] = useState<RefundStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Detail modal
  const [selectedRefund, setSelectedRefund] = useState<RefundDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Initiate refund form
  const [showInitiate, setShowInitiate] = useState(false);
  const [initiateForm, setInitiateForm] = useState({ orderId: '', amount: '', reason: '' });
  const [initiating, setInitiating] = useState(false);

  // Processing state
  const [processing, setProcessing] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Load refunds ──────────────────────────────────────────────────────────

  const loadRefunds = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenantId: TENANT_ID, page: String(pageNum), limit: String(limit) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`${API_BASE}/api/refunds?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: PaginatedRefunds = await res.json();
      setRefunds(data.refunds || []);
      setPage(data.page || pageNum);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load refunds.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, startDate, endDate, limit]);

  const loadStats = useCallback(async () => {
    try {
      const params = new URLSearchParams({ tenantId: TENANT_ID });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`${API_BASE}/api/refunds/stats?${params}`);
      if (res.ok) {
        const data: RefundStats = await res.json();
        setStats(data);
      }
    } catch {
      // non-critical
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadRefunds(1);
  }, [loadRefunds]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleInitiateRefund = async () => {
    if (!initiateForm.orderId.trim() || !initiateForm.amount.trim()) {
      showToast('error', 'Order ID and amount are required.');
      return;
    }

    const amount = parseFloat(initiateForm.amount);
    if (isNaN(amount) || amount <= 0) {
      showToast('error', 'Enter a valid refund amount.');
      return;
    }

    setInitiating(true);
    try {
      const res = await fetch(`${API_BASE}/api/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: initiateForm.orderId,
          amount,
          reason: initiateForm.reason || 'Customer requested refund',
          tenantId: TENANT_ID,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      const refund = await res.json();
      showToast('success', `Refund ${refund.id} initiated successfully.`);
      setShowInitiate(false);
      setInitiateForm({ orderId: '', amount: '', reason: '' });
      loadRefunds(1);
      loadStats();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initiate refund.';
      showToast('error', message);
    } finally {
      setInitiating(false);
    }
  };

  const handleProcess = async (refundId: string) => {
    setProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/refunds/${refundId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      const refund = await res.json();
      showToast('success', `Refund ${refund.id} status updated to ${refund.status}.`);
      loadRefunds(page);
      loadStats();
      if (selectedRefund?.id === refundId) {
        setSelectedRefund(refund);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process refund.';
      showToast('error', message);
    } finally {
      setProcessing(false);
    }
  };

  const openDetail = async (refundId: string) => {
    setLoadingDetail(true);
    setSelectedRefund(null);
    try {
      const res = await fetch(`${API_BASE}/api/refunds/${refundId}`);
      if (!res.ok) throw new Error('Failed to load refund detail');
      const data: RefundDetail = await res.json();
      setSelectedRefund(data);
    } catch {
      showToast('error', 'Failed to load refund details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedRefund(null);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Heading as="h2" className="text-2xl font-bold text-slate-900">Refunds</Heading>
            <Text variant="muted" className="mt-1">Manage and track refund requests</Text>
          </div>
          <Button onClick={() => setShowInitiate(true)}>+ Initiate Refund</Button>
        </div>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Refunded</Text>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(stats.totalRefunded)}</p>
            </Card>
            <Card className="p-4">
              <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Refund Count</Text>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stats.refundCount}</p>
            </Card>
            <Card className="p-4">
              <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Average Amount</Text>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(stats.averageRefundAmount)}</p>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
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
              {REFUND_STATUSES.map((s) => (
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
            <button onClick={() => loadRefunds(page)} className="ml-3 underline font-medium">Retry</button>
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

        {/* Refunds table */}
        {!loading && !error && (
          refunds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl">💰</div>
              <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">No refunds found</Heading>
              <Text variant="muted" className="mt-2">Refunds will appear here when customers request them.</Text>
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Refund ID</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Order</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Amount</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Provider</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Date</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {refunds.map((refund) => (
                      <tr key={refund.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{refund.id.slice(0, 12)}…</p>
                          {refund.transactionId && (
                            <p className="text-xs text-slate-500 mt-0.5">TXN: {refund.transactionId}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {refund.orderId.slice(0, 12)}…
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          -{formatCurrency(Number(refund.amount), refund.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_COLORS[refund.status] || 'neutral'}>{refund.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {refund.provider ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {formatDateTime(refund.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-1.5 justify-center">
                            <Button size="sm" variant="outline" onClick={() => openDetail(refund.id)}>
                              View
                            </Button>
                            {refund.status === 'PENDING' && (
                              <Button
                                size="sm"
                                onClick={() => handleProcess(refund.id)}
                                disabled={processing}
                              >
                                {processing ? 'Processing…' : 'Process'}
                              </Button>
                            )}
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
                    Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} refunds
                  </Text>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadRefunds(page - 1)}
                      disabled={page <= 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                      ← Previous
                    </button>
                    <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => loadRefunds(page + 1)}
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

      {/* ─── Initiate Refund Modal ─────────────────────────────────────────── */}
      {showInitiate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowInitiate(false)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <Heading as="h3" className="text-lg font-semibold">Initiate Refund</Heading>
              <Text variant="muted" className="mt-1 text-sm">Create a refund record for a completed order.</Text>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Order ID *</label>
                  <Input
                    value={initiateForm.orderId}
                    onChange={(e) => setInitiateForm({ ...initiateForm, orderId: e.target.value })}
                    placeholder="Order ID"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Refund Amount *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={initiateForm.amount}
                    onChange={(e) => setInitiateForm({ ...initiateForm, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Reason</label>
                  <textarea
                    value={initiateForm.reason}
                    onChange={(e) => setInitiateForm({ ...initiateForm, reason: e.target.value })}
                    rows={3}
                    placeholder="Reason for refund…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6 justify-end">
                <Button variant="outline" onClick={() => { setShowInitiate(false); setInitiateForm({ orderId: '', amount: '', reason: '' }); }}>
                  Cancel
                </Button>
                <Button onClick={handleInitiateRefund} disabled={initiating}>
                  {initiating ? 'Initiating…' : 'Initiate Refund'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Refund Detail Modal ───────────────────────────────────────────── */}
      {selectedRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeDetail}>
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <Heading as="h3" className="text-lg font-semibold">Refund {selectedRefund.id.slice(0, 12)}…</Heading>
                  <Text variant="muted" className="mt-0.5">Requested {formatDateTime(selectedRefund.createdAt)}</Text>
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="p-4">
                      <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</Text>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        -{formatCurrency(Number(selectedRefund.amount), selectedRefund.currency)}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status</Text>
                      <div className="mt-2">
                        <Badge variant={STATUS_COLORS[selectedRefund.status] || 'neutral'}>{selectedRefund.status}</Badge>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Provider</Text>
                      <p className="mt-1 text-sm text-slate-900">{selectedRefund.provider ?? '—'}</p>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="p-4">
                      <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Order</Text>
                      <p className="mt-1 text-sm text-slate-900 font-mono">
                        {selectedRefund.orderId.slice(0, 24)}…
                      </p>
                      {selectedRefund.order && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {selectedRefund.order.orderNumber} · {selectedRefund.order.status}
                        </p>
                      )}
                    </Card>
                    <Card className="p-4">
                      <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Payment</Text>
                      <p className="mt-1 text-sm text-slate-900 font-mono">
                        {selectedRefund.paymentId?.slice(0, 24) ?? '—'}
                      </p>
                      {selectedRefund.payment && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {selectedRefund.payment.method}
                          {selectedRefund.payment.transactionId && ` · ${selectedRefund.payment.transactionId}`}
                        </p>
                      )}
                    </Card>
                  </div>

                  {selectedRefund.transactionId && (
                    <Card className="p-4">
                      <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Transaction ID</Text>
                      <p className="mt-1 text-sm text-slate-900 font-mono">{selectedRefund.transactionId}</p>
                    </Card>
                  )}

                  {selectedRefund.reason && (
                    <Card className="p-4">
                      <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Reason</Text>
                      <p className="mt-1 text-sm text-slate-700">{selectedRefund.reason}</p>
                    </Card>
                  )}

                  <div className="flex flex-col gap-1 text-xs text-slate-500">
                    <span>Created: {formatDateTime(selectedRefund.createdAt)}</span>
                    {selectedRefund.refundedAt && <span>Refunded: {formatDateTime(selectedRefund.refundedAt)}</span>}
                  </div>

                  {/* Actions */}
                  {selectedRefund.status === 'PENDING' && (
                    <div className="flex justify-end pt-2">
                      <Button onClick={() => handleProcess(selectedRefund.id)} disabled={processing}>
                        {processing ? 'Processing…' : 'Process Refund'}
                      </Button>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button variant="outline" onClick={closeDetail}>Close</Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ─── Toast ────────────────────────────────────────────────────────── */}
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
