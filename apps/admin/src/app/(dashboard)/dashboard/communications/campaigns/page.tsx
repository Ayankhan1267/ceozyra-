'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Heading, Text, Badge, Button, Card, Input, Sheet } from '@zyra/ui';

const API_BASE = 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

const CAMPAIGN_TYPES = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'SOCIAL'] as const;
const STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const;

const TYPE_COLORS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'neutral'> = {
  EMAIL: 'info',
  SMS: 'success',
  WHATSAPP: 'success',
  PUSH: 'warning',
  SOCIAL: 'default',
};

const STATUS_COLORS: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  PAUSED: 'warning',
  COMPLETED: 'info',
  CANCELLED: 'danger',
};

type Campaign = {
  id: string;
  name: string;
  type: string;
  objective?: string;
  status: string;
  budget: number;
  spend: number;
  startDate?: string;
  endDate?: string;
  createdAt: string;
};

type PaginatedCampaigns = {
  campaigns: Campaign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Form sheet
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('EMAIL');
  const [formObjective, setFormObjective] = useState('');
  const [formBudget, setFormBudget] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Stats ───────────────────────────────────────────────────────────────────

  const stats = {
    total: campaigns.length,
    active: campaigns.filter((c) => c.status === 'ACTIVE').length,
    totalBudget: campaigns.reduce((sum, c) => sum + Number(c.budget || 0), 0),
    totalSpend: campaigns.reduce((sum, c) => sum + Number(c.spend || 0), 0),
  };

  // ─── Load campaigns ─────────────────────────────────────────────────────────

  const loadCampaigns = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tenantId: TENANT_ID,
        page: String(pageNum),
        limit: String(limit),
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`${API_BASE}/api/communications/campaigns?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: PaginatedCampaigns = await res.json();
      setCampaigns(data.campaigns || []);
      setPage(data.page || pageNum);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load campaigns.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, limit]);

  useEffect(() => {
    loadCampaigns(1);
  }, [loadCampaigns]);

  // ─── Search ─────────────────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (!value.trim()) {
        loadCampaigns(1);
        return;
      }
      setLoading(true);
      fetch(`${API_BASE}/api/communications/campaigns?${new URLSearchParams({ tenantId: TENANT_ID, limit: '50' })}`)
        .then((r) => r.json())
        .then((data: PaginatedCampaigns) => {
          const q = value.toLowerCase();
          const filtered = (data.campaigns || []).filter((c) => c.name.toLowerCase().includes(q));
          setCampaigns(filtered);
          setTotalPages(1);
          setTotal(filtered.length);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 400);
  };

  // ─── Open form ──────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingCampaign(null);
    setFormName('');
    setFormType('EMAIL');
    setFormObjective('');
    setFormBudget('');
    setFormStartDate('');
    setFormEndDate('');
    setShowForm(true);
  };

  const openEdit = (camp: Campaign) => {
    setEditingCampaign(camp);
    setFormName(camp.name);
    setFormType(camp.type);
    setFormObjective(camp.objective || '');
    setFormBudget(String(camp.budget || ''));
    setFormStartDate(camp.startDate ? camp.startDate.slice(0, 10) : '');
    setFormEndDate(camp.endDate ? camp.endDate.slice(0, 10) : '');
    setShowForm(true);
  };

  // ─── Save campaign ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!formName.trim()) {
      showToast('error', 'Campaign name is required.');
      return;
    }
    setSaving(true);
    try {
      const method = editingCampaign ? 'PATCH' : 'POST';
      const url = editingCampaign
        ? `${API_BASE}/api/communications/campaigns/${editingCampaign.id}`
        : `${API_BASE}/api/communications/campaigns`;

      const body = {
        tenantId: TENANT_ID,
        name: formName,
        type: formType,
        objective: formObjective || undefined,
        budget: formBudget ? parseFloat(formBudget) : 0,
        startDate: formStartDate || undefined,
        endDate: formEndDate || undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', editingCampaign ? 'Campaign updated.' : 'Campaign created.');
      setShowForm(false);
      loadCampaigns(1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save campaign.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Status actions ─────────────────────────────────────────────────────────

  const handleStatusAction = async (camp: Campaign, action: 'start' | 'pause' | 'complete') => {
    try {
      const res = await fetch(`${API_BASE}/api/communications/campaigns/${camp.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', `Campaign ${action}ed.`);
      loadCampaigns(page);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to ${action} campaign.`;
      showToast('error', message);
    }
  };

  // ─── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/communications/campaigns/${deleteId}?tenantId=${TENANT_ID}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Campaign deleted.');
      setDeleteId(null);
      loadCampaigns(page);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete campaign.';
      showToast('error', message);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Toast helper ────────────────────────────────────────────────────────────

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Heading as="h1" className="text-2xl font-bold text-slate-900">Campaigns</Heading>
            <Text variant="muted" className="mt-1">Manage marketing campaigns and track performance</Text>
          </div>
          <Button onClick={openCreate}>+ New Campaign</Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Campaigns</Text>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active</Text>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</p>
          </Card>
          <Card className="p-4">
            <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Budget</Text>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stats.totalBudget)}</p>
          </Card>
          <Card className="p-4">
            <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Spend</Text>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stats.totalSpend)}</p>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search campaigns…"
                className="w-full"
              />
            </div>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
              <button
                onClick={() => { setStatusFilter('all'); setPage(1); }}
                className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                All
              </button>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => loadCampaigns(page)} className="ml-3 underline font-medium">Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
                <div className="h-5 w-48 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-64 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        )}

        {/* Campaigns table */}
        {!loading && !error && (
          campaigns.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <div className="text-5xl">🚀</div>
              <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">No campaigns yet</Heading>
              <Text variant="muted" className="mt-2">Create your first campaign to start reaching customers.</Text>
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Budget</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Spend</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Dates</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {campaigns.map((camp) => (
                      <tr key={camp.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{camp.name}</p>
                          {camp.objective && <p className="text-xs text-slate-500 mt-0.5">{camp.objective}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={TYPE_COLORS[camp.type] || 'neutral'}>{camp.type}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_COLORS[camp.status] || 'neutral'}>{camp.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatCurrency(Number(camp.budget))}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {formatCurrency(Number(camp.spend))}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                          {camp.startDate || endDate(camp)} {camp.endDate ? `– ${formatDate(camp.endDate)}` : ''}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {camp.status === 'DRAFT' && (
                              <Button size="sm" variant="default" onClick={() => handleStatusAction(camp, 'start')}>Start</Button>
                            )}
                            {camp.status === 'ACTIVE' && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleStatusAction(camp, 'pause')}>Pause</Button>
                                <Button size="sm" variant="default" onClick={() => handleStatusAction(camp, 'complete')}>Complete</Button>
                              </>
                            )}
                            {camp.status === 'PAUSED' && (
                              <Button size="sm" variant="default" onClick={() => handleStatusAction(camp, 'start')}>Resume</Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => openEdit(camp)}>Edit</Button>
                            <Button size="sm" variant="destructive" onClick={() => setDeleteId(camp.id)}>Delete</Button>
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
                    Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} campaigns
                  </Text>
                  <div className="flex items-center gap-2">
                    <button onClick={() => loadCampaigns(page - 1)} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors">
                      Previous
                    </button>
                    <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                    <button onClick={() => loadCampaigns(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors">
                      Next
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )
        )}
      </div>

      {/* ─── Create/Edit Form Sheet ───────────────────────────────────────────── */}

      <Sheet open={showForm} onClose={() => setShowForm(false)} title={editingCampaign ? 'Edit Campaign' : 'New Campaign'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Campaign Name *</label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Campaign name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CAMPAIGN_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Objective</label>
            <Input value={formObjective} onChange={(e) => setFormObjective(e.target.value)} placeholder="Campaign objective" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Budget (USD)</label>
            <Input type="number" value={formBudget} onChange={(e) => setFormBudget(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
            <input
              type="date"
              value={formStartDate}
              onChange={(e) => setFormStartDate(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
            <input
              type="date"
              value={formEndDate}
              onChange={(e) => setFormEndDate(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving…' : editingCampaign ? 'Update Campaign' : 'Create Campaign'}
          </Button>
        </div>
      </Sheet>

      {/* ─── Delete Confirmation Sheet ────────────────────────────────────────── */}

      <Sheet open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Campaign">
        <div className="space-y-4">
          <Text>Are you sure you want to delete this campaign? This action cannot be undone.</Text>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="flex-1">
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Sheet>

      {toast && (
        <div
          className={`fixed top-6 right-6 z-[60] rounded-lg px-5 py-3 shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </>
  );
}

function endDate(camp: { endDate?: string }) {
  return camp.endDate ? formatDate(camp.endDate) : '—';
}
