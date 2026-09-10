'use client';

import { useState, useCallback, useEffect } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { Heading, Text, Badge, Button, Card, Textarea } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

interface Approval {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  requestedBy: string | null;
  risk: string | null;
  confidence: number | null;
  cost: number | null;
  expectedOutcome: Record<string, unknown> | null;
  evidence: Record<string, unknown> | null;
  expiresAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';

const STATUS_COLORS: Record<string, 'success' | 'danger' | 'neutral' | 'warning'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
};

const TYPE_LABELS: Record<string, string> = {
  CAMPAIGN: 'Campaign',
  DISCOUNT: 'Discount',
  EXPENSE: 'Expense',
  PRODUCT: 'Product',
  PRICE_CHANGE: 'Price Change',
  ORDER_REFUND: 'Order Refund',
  INTEGRATION: 'Integration',
  AUTOMATION: 'Automation',
  CONTENT_PUBLISH: 'Content Publish',
  AD_SPEND: 'Ad Spend',
};

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
];

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [actionForm, setActionForm] = useState<{ id: string; mode: 'approve' | 'reject' } | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/approvals?tenantId=${TENANT_ID}&limit=100`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setApprovals(data.approvals || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load approvals.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const openActionForm = (id: string, mode: 'approve' | 'reject') => {
    setActionForm({ id, mode });
    setReason('');
  };

  const closeActionForm = () => {
    setActionForm(null);
    setReason('');
  };

  const submitAction = async () => {
    if (!actionForm) return;
    const endpoint = actionForm.mode === 'approve' ? 'approve' : 'reject';
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/approvals/${actionForm.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setApprovals((prev) =>
        prev.map((a) => (a.id === actionForm.id ? { ...a, ...data } : a)),
      );
      showToast('success', `Approval ${endpoint}d successfully.`);
      closeActionForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to ${endpoint} approval.`;
      showToast('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const cancelApproval = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/approvals/${id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
      showToast('success', 'Approval cancelled.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel approval.';
      showToast('error', message);
    }
  };

  // Filter logic
  const filtered = activeFilter === 'all'
    ? approvals
    : approvals.filter((a) => a.status.toLowerCase() === activeFilter);

  // Stats
  const counts = approvals.reduce<Record<string, number>>((acc, a) => {
    const key = a.status.toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const confidenceColor = (val: number | null) => {
    if (val == null) return 'text-slate-500';
    if (val >= 80) return 'text-emerald-600';
    if (val >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const riskBadgeVariant: Record<string, 'danger' | 'warning' | 'default' | 'neutral'> = {
    critical: 'danger',
    high: 'danger',
    medium: 'warning',
    low: 'default',
  };

  const activeAction = actionForm;

  return (
    <DashboardShell
      sidebarProps={{
        logo: <span className="text-lg font-bold text-indigo-600">ZYRA</span>,
        navLinks: [
          { href: '/dashboard', label: 'Overview' },
          { href: '/dashboard/chat', label: 'Talk to ZYRA' },
          { href: '/dashboard/approvals', label: 'Approvals', active: true },
          { href: '/dashboard/orders', label: 'Orders' },
          { href: '/dashboard/products', label: 'Products' },
          { href: '/dashboard/customers', label: 'Customers' },
          { href: '/dashboard/finance', label: 'Finance' },
        ],
        user: { name: 'Admin', email: 'owner@demo.com', initials: 'A' },
      }}
      headerProps={{
        title: 'Approvals',
        subtitle: 'Manage approval requests',
      }}
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            { label: 'Pending', count: counts.pending || 0, variant: 'warning' as const },
            { label: 'Approved', count: counts.approved || 0, variant: 'success' as const },
            { label: 'Rejected', count: counts.rejected || 0, variant: 'danger' as const },
            { label: 'Cancelled', count: counts.cancelled || 0, variant: 'neutral' as const },
            { label: 'Expired', count: counts.expired || 0, variant: 'neutral' as const },
          ].map((stat) => (
            <Card key={stat.label} className="p-4">
              <Text variant="small" className="text-slate-500">{stat.label}</Text>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stat.count}</p>
            </Card>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={[
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 rounded-t-md',
                activeFilter === tab.value
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              ].join(' ')}
            >
              {tab.label}
              {tab.value !== 'all' && counts[tab.value] ? (
                <span className={[
                  'ml-1.5 rounded-full px-1.5 py-0.5 text-xs',
                  activeFilter === tab.value
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-600',
                ].join(' ')}>
                  {counts[tab.value]}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Action form (inline) */}
        {activeAction && (
          <Card className="p-5 border-indigo-200 bg-indigo-50/50">
            <Heading as="h4" className="text-base font-semibold text-slate-900">
              {activeAction.mode === 'approve' ? 'Approve' : 'Reject'} Approval
            </Heading>
            <Text variant="muted" className="mt-1">
              Provide a reason for this {activeAction.mode}.
            </Text>
            <div className="mt-4">
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={`Reason for ${activeAction.mode}ing (optional)...`}
                rows={3}
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button
                onClick={submitAction}
                disabled={submitting}
                variant={activeAction.mode === 'approve' ? 'default' : 'destructive'}
                size="sm"
              >
                {submitting ? 'Submitting...' : activeAction.mode === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </Button>
              <button
                type="button"
                onClick={closeActionForm}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </Card>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button
              type="button"
              onClick={loadApprovals}
              className="ml-3 underline font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div
            className={[
              'fixed top-6 right-6 z-50 rounded-lg px-5 py-3 shadow-lg text-sm font-medium transition-all',
              toast.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white',
            ].join(' ')}
            role="alert"
          >
            {toast.message}
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

        {/* Approvals list */}
        {!loading && !error && (
          <>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-5xl">📋</div>
                <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">
                  No approvals found
                </Heading>
                <Text variant="muted" className="mt-2 max-w-sm">
                  {activeFilter === 'all'
                    ? 'There are no approval requests yet. Approvals are created by agents or admins when actions require sign-off.'
                    : `No ${activeFilter.toLowerCase()} approvals at this time.`}
                </Text>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((approval) => (
                  <Card key={approval.id} className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Heading as="h4" className="text-sm font-semibold text-slate-900">
                            {approval.title}
                          </Heading>
                          <Badge variant="default">{TYPE_LABELS[approval.type] || approval.type}</Badge>
                          <Badge variant={STATUS_COLORS[approval.status] || 'neutral'}>
                            {approval.status}
                          </Badge>
                        </div>
                        {approval.description && (
                          <Text variant="muted" className="mt-1 line-clamp-1">
                            {approval.description}
                          </Text>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <span className="font-medium text-slate-400">ID:</span> {approval.id.slice(0, 12)}...
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="font-medium text-slate-400">Created:</span> {formatDate(approval.createdAt)}
                          </span>
                          {approval.decidedAt && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium text-slate-400">Decided:</span> {formatDate(approval.decidedAt)}
                            </span>
                          )}
                          {approval.confidence != null && (
                            <span className={`flex items-center gap-1 ${confidenceColor(approval.confidence)}`}>
                              <span className="font-medium text-slate-400">Confidence:</span> {approval.confidence}%
                            </span>
                          )}
                          {approval.cost != null && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium text-slate-400">Cost:</span> ${approval.cost.toLocaleString()}
                            </span>
                          )}
                          {approval.risk && (
                            <Badge variant={riskBadgeVariant[approval.risk] || 'neutral'} className="text-xs">
                              Risk: {approval.risk}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Actions for PENDING */}
                      {approval.status === 'PENDING' && (
                        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                          <Button
                            onClick={() => openActionForm(approval.id, 'approve')}
                            size="sm"
                            disabled={!!activeAction}
                          >
                            Approve
                          </Button>
                          <Button
                            onClick={() => openActionForm(approval.id, 'reject')}
                            size="sm"
                            variant="destructive"
                            disabled={!!activeAction}
                          >
                            Reject
                          </Button>
                          <button
                            type="button"
                            onClick={() => cancelApproval(approval.id)}
                            disabled={!!activeAction}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
