'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Heading, Text, Badge, Button, Card, Input, Label, Select, Sheet, Tabs, TabPanel } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  companyId: string | null;
  company?: { id: string; name: string } | null;
  source: string;
  status: string;
  score: number;
  assignedToId: string | null;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
  notes: string | null;
  convertedToCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaginatedLeads = {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type LeadStats = {
  total: number;
  newLeads: number;
  qualifiedLeads: number;
  wonLeads: number;
  conversionRate: number;
  totalPipelineValue: number;
};

type Company = {
  id: string;
  name: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] as const;

const STATUS_COLORS: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'default'> = {
  NEW: 'neutral',
  CONTACTED: 'info',
  QUALIFIED: 'warning',
  PROPOSAL: 'info',
  WON: 'success',
  LOST: 'danger',
};

const LEAD_SOURCES = ['website', 'referral', 'social_media', 'email', 'cold_call', 'event', 'other'] as const;

const SCORE_COLORS: Record<string, string> = {
  low: 'text-red-600',
  medium: 'text-amber-600',
  high: 'text-blue-600',
  excellent: 'text-emerald-600',
};

function getScoreColor(score: number): string {
  if (score <= 25) return SCORE_COLORS.low;
  if (score <= 50) return SCORE_COLORS.medium;
  if (score <= 75) return SCORE_COLORS.high;
  return SCORE_COLORS.excellent;
}

function getScoreLabel(score: number): string {
  if (score <= 25) return 'Cold';
  if (score <= 50) return 'Warm';
  if (score <= 75) return 'Hot';
  return 'Ready';
}

const PIPELINE_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  // Leads list state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);

  // Stats
  const [stats, setStats] = useState<LeadStats | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Companies (for dropdown)
  const [companies, setCompanies] = useState<Company[]>([]);

  // Add/Edit Sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyId: '',
    source: 'website',
    status: 'NEW',
    score: 0,
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Detail Sheet
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Pipeline stage filter
  const [pipelineStageFilter, setPipelineStageFilter] = useState<string>('all');

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Toast helper ────────────────────────────────────────────────────────────

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Load companies ──────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/companies?tenantId=${TENANT_ID}`);
        if (res.ok) {
          const data = await res.json();
          setCompanies(Array.isArray(data) ? data : (data.companies || []));
        }
      } catch { /* silently ignore */ }
    })();
  }, []);

  // ─── Load stats ─────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/leads/stats?tenantId=${TENANT_ID}`);
      if (res.ok) {
        const data: LeadStats = await res.json();
        setStats(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // ─── Load leads ─────────────────────────────────────────────────────────────

  const loadLeads = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenantId: TENANT_ID, page: String(pageNum), limit: String(limit) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);

      const res = await fetch(`${API_BASE}/api/leads?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: PaginatedLeads = await res.json();
      let filtered = data.leads || [];
      // Client-side search
      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (l) =>
            l.firstName.toLowerCase().includes(q) ||
            l.lastName.toLowerCase().includes(q) ||
            l.email.toLowerCase().includes(q) ||
            (l.company?.name || '').toLowerCase().includes(q)
        );
      }
      setLeads(filtered);
      setPage(data.page || pageNum);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || filtered.length);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load leads.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter, limit, search]);

  useEffect(() => {
    loadLeads(1);
  }, [loadLeads]);

  // ─── Search ──────────────────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) {
      loadLeads(1);
      return;
    }
    searchTimer.current = setTimeout(() => loadLeads(1), 500);
  };

  // ─── Open add lead sheet ─────────────────────────────────────────────────────

  const openAddSheet = () => {
    setEditingLead(null);
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      companyId: '',
      source: 'website',
      status: 'NEW',
      score: 0,
      notes: '',
    });
    setSheetOpen(true);
  };

  // ─── Open edit sheet ─────────────────────────────────────────────────────────

  const openEditSheet = (lead: Lead) => {
    setEditingLead(lead);
    setForm({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone || '',
      companyId: lead.companyId || '',
      source: lead.source,
      status: lead.status,
      score: lead.score,
      notes: lead.notes || '',
    });
    setSheetOpen(true);
  };

  // ─── Submit lead form ────────────────────────────────────────────────────────

  const handleLeadSubmit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      showToast('error', 'First name, last name, and email are required.');
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
        companyId: form.companyId || null,
        source: form.source,
        status: form.status,
        score: Number(form.score),
        notes: form.notes.trim() || null,
      };

      const url = editingLead
        ? `${API_BASE}/api/leads/${editingLead.id}?tenantId=${TENANT_ID}`
        : `${API_BASE}/api/leads?tenantId=${TENANT_ID}`;

      const res = await fetch(url, {
        method: editingLead ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      showToast('success', editingLead ? 'Lead updated successfully.' : 'Lead created successfully.');
      setSheetOpen(false);
      loadLeads(page);
      loadStats();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save lead.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Convert lead to customer ────────────────────────────────────────────────

  const handleConvert = async (lead: Lead) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/leads/${lead.id}/convert?tenantId=${TENANT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Lead converted to customer.');
      loadLeads(page);
      loadStats();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to convert lead.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete lead ─────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/leads/${deleteId}?tenantId=${TENANT_ID}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Lead deleted.');
      setDeleteId(null);
      loadLeads(page);
      loadStats();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete lead.';
      showToast('error', message);
    } finally {
      setDeleting(false);
    }
  };

  // ─── View detail ─────────────────────────────────────────────────────────────

  const openDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailOpen(true);
  };

  // ─── Pipeline group by stage ─────────────────────────────────────────────────

  const pipelineLeads = pipelineStageFilter === 'all'
    ? leads
    : leads.filter((l) => l.status === pipelineStageFilter);

  const groupedByStage: Record<string, Lead[]> = {};
  PIPELINE_STAGES.forEach((stage) => {
    groupedByStage[stage] = pipelineLeads.filter((l) => l.status === stage);
  });

  // ─── Stats cards data ────────────────────────────────────────────────────────

  const statCards = [
    { label: 'Total Leads', value: stats?.total ?? total, icon: '👥', color: 'bg-indigo-50 text-indigo-700' },
    { label: 'New Leads', value: stats?.newLeads ?? leads.filter(l => l.status === 'NEW').length, icon: '🆕', color: 'bg-slate-100 text-slate-700' },
    { label: 'Qualified', value: stats?.qualifiedLeads ?? leads.filter(l => l.status === 'QUALIFIED').length, icon: '⭐', color: 'bg-amber-50 text-amber-700' },
    { label: 'Won', value: stats?.wonLeads ?? leads.filter(l => l.status === 'WON').length, icon: '🏆', color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Conversion Rate', value: stats?.conversionRate != null ? `${stats.conversionRate.toFixed(1)}%` : '—', icon: '📈', color: 'bg-blue-50 text-blue-700' },
    { label: 'Pipeline Value', value: formatCurrency(stats?.totalPipelineValue ?? 0), icon: '💰', color: 'bg-violet-50 text-violet-700' },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Heading as="h2" className="text-2xl font-bold text-slate-900">Leads</Heading>
            <Text variant="muted" className="mt-1">Manage leads and track your sales pipeline</Text>
          </div>
          <Button onClick={openAddSheet}>+ Add Lead</Button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((stat) => (
            <Card key={stat.label} className="p-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{stat.icon}</span>
                <Text variant="muted" className="text-xs">{stat.label}</Text>
              </div>
              <p className={`mt-2 text-lg font-bold ${stat.color}`}>{stat.value}</p>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search by name, email, or company…"
                  className="w-full"
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  ...LEAD_STATUSES.map((s) => ({ value: s, label: s })),
                ]}
                className="w-full sm:w-40"
              />
              <Select
                value={sourceFilter}
                onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                options={[
                  { value: 'all', label: 'All Sources' },
                  ...LEAD_SOURCES.map((s) => ({ value: s, label: s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) })),
                ]}
                className="w-full sm:w-40"
              />
            </div>
          </div>
        </Card>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => loadLeads(page)} className="ml-3 underline font-medium">Retry</button>
          </div>
        )}

        {/* Tabs: All Leads | Pipeline | Import */}
        <Tabs
          defaultValue="all"
          tabs={[
            { value: 'all', label: 'All Leads' },
            { value: 'pipeline', label: 'Pipeline View' },
            { value: 'import', label: 'Import' },
          ]}
        >
          {/* TabPanel: All Leads */}
          <TabPanel value="all" activeTab="all">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
                    <div className="h-5 w-48 rounded bg-slate-200" />
                    <div className="mt-3 h-3 w-32 rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50">
                        <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Email</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Phone</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Company</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Source</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Score</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Assigned To</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Created</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leads.length === 0 ? (
                        <tr>
                          <td colSpan={10}>
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                              <div className="text-5xl">🎯</div>
                              <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">No leads found</Heading>
                              <Text variant="muted" className="mt-2">Add your first lead or adjust your filters.</Text>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        leads.map((lead) => (
                          <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-900">{lead.firstName} {lead.lastName}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{lead.email}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{lead.phone || '—'}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{lead.company?.name || '—'}</td>
                            <td className="px-4 py-3">
                              <Badge variant={STATUS_COLORS[lead.status] || 'neutral'}>{lead.status}</Badge>
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-xs capitalize">
                              {lead.source.replace('_', ' ')}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-sm font-semibold ${getScoreColor(lead.score)}`}>
                                {lead.score}
                              </span>
                              <span className="text-xs text-slate-400 ml-1">({getScoreLabel(lead.score)})</span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-xs">
                              {lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{formatDate(lead.createdAt)}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => openDetail(lead)} title="View">
                                  👁
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => openEditSheet(lead)} title="Edit">
                                  ✏️
                                </Button>
                                {lead.status !== 'WON' && lead.status !== 'LOST' && (
                                  <Button size="sm" variant="ghost" onClick={() => handleConvert(lead)} title="Convert to Customer" disabled={saving}>
                                    ✅
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => setDeleteId(lead.id)} title="Delete" className="text-red-600 hover:text-red-700">
                                  🗑
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                    <Text variant="muted" className="text-xs">
                      Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} leads
                    </Text>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadLeads(page - 1)}
                        disabled={page <= 1}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                      >
                        ← Previous
                      </button>
                      <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                      <button
                        onClick={() => loadLeads(page + 1)}
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
          </TabPanel>

          {/* TabPanel: Pipeline View */}
          <TabPanel value="pipeline" activeTab="pipeline">
            {/* Pipeline stage filter */}
            <div className="flex items-center gap-3 mb-4">
              <Select
                value={pipelineStageFilter}
                onChange={(e) => setPipelineStageFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Stages' },
                  ...PIPELINE_STAGES.map((s) => ({ value: s, label: s })),
                ]}
                className="w-full sm:w-48"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {PIPELINE_STAGES.map((stage) => {
                const stageLeads = groupedByStage[stage] || [];
                return (
                  <div key={stage} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stage}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={STATUS_COLORS[stage] || 'neutral'}>{stageLeads.length}</Badge>
                      </div>
                    </div>
                    <div className="space-y-2 min-h-[100px] rounded-xl border border-dashed border-slate-200 bg-slate-50/30 p-2">
                      {stageLeads.length === 0 ? (
                        <Text variant="muted" className="text-xs text-center py-4">No leads</Text>
                      ) : (
                        stageLeads.map((lead) => (
                          <Card key={lead.id} className="p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(lead)}>
                            <p className="text-sm font-medium text-slate-900">{lead.firstName} {lead.lastName}</p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{lead.email}</p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className={`text-xs font-semibold ${getScoreColor(lead.score)}`}>{lead.score} pts</span>
                              <span className="text-xs text-slate-400">{lead.company?.name || '—'}</span>
                            </div>
                            {lead.assignedTo && (
                              <p className="text-xs text-slate-400 mt-1">{lead.assignedTo.firstName} {lead.assignedTo.lastName}</p>
                            )}
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabPanel>

          {/* TabPanel: Import */}
          <TabPanel value="import" activeTab="import">
            <Card className="p-8">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-5xl mb-4">📥</div>
                <Heading as="h3" className="text-lg font-semibold text-slate-900">Import Leads from CSV</Heading>
                <Text variant="muted" className="mt-2 max-w-md">
                  Upload a CSV file with lead data. The file should include columns for first name, last name, email, phone, company, source, status, and score.
                </Text>

                <div className="mt-6 w-full max-w-lg">
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-indigo-400 transition-colors cursor-pointer bg-slate-50/50">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl">📁</span>
                      <Text variant="muted" className="text-sm">Drag and drop your CSV file here, or click to browse</Text>
                      <input
                        type="file"
                        accept=".csv"
                        className="text-sm text-slate-600"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            showToast('success', `File "${e.target.files[0].name}" selected. Import coming soon.`);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-left w-full max-w-lg">
                  <Heading as="h4" className="text-sm font-semibold text-slate-700 mb-2">CSV Format Instructions</Heading>
                  <Text variant="muted" className="text-xs">
                    Your CSV should have the following columns (first row is headers):
                  </Text>
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 font-mono overflow-x-auto">
                    firstName, lastName, email, phone, company, source, status, score, notes
                  </div>
                  <ul className="mt-2 text-xs text-slate-500 list-disc list-inside space-y-1">
                    <li><strong>source</strong>: website, referral, social_media, email, cold_call, event, other</li>
                    <li><strong>status</strong>: NEW, CONTACTED, QUALIFIED, PROPOSAL, WON, LOST</li>
                    <li><strong>score</strong>: integer from 0 to 100</li>
                    <li><strong>company</strong>: company name (will be matched or created)</li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabPanel>
        </Tabs>
      </div>

      {/* ─── Add/Edit Lead Sheet ─────────────────────────────────────────────── */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        side="right"
        title={editingLead ? 'Edit Lead' : 'Add New Lead'}
      >
        <div className="space-y-4">
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">First Name *</Label>
            <Input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="John"
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</Label>
            <Input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Doe"
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="john@example.com"
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
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Company</Label>
            <Select
              value={form.companyId}
              onChange={(e) => setForm({ ...form, companyId: e.target.value })}
              options={[
                { value: '', label: 'Select a company…' },
                ...companies.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Source</Label>
            <Select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              options={LEAD_SOURCES.map((s) => ({
                value: s,
                label: s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
              }))}
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Status</Label>
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Score (0-100)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={form.score}
              onChange={(e) => setForm({ ...form, score: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Notes</Label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Additional notes…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleLeadSubmit} disabled={saving} className="flex-1">
              {saving ? 'Saving…' : editingLead ? 'Update Lead' : 'Add Lead'}
            </Button>
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      </Sheet>

      {/* ─── Detail Sheet ────────────────────────────────────────────────────── */}
      {selectedLead && (
        <Sheet
          open={detailOpen}
          onClose={() => { setDetailOpen(false); setSelectedLead(null); }}
          side="right"
          title="Lead Details"
        >
          {selectedLead && (
            <div className="space-y-5">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Name</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{selectedLead.firstName} {selectedLead.lastName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Email</p>
                <p className="text-sm text-slate-700 mt-0.5">{selectedLead.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Phone</p>
                <p className="text-sm text-slate-700 mt-0.5">{selectedLead.phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Company</p>
                <p className="text-sm text-slate-700 mt-0.5">{selectedLead.company?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Status</p>
                <div className="mt-1">
                  <Badge variant={STATUS_COLORS[selectedLead.status] || 'neutral'}>{selectedLead.status}</Badge>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Source</p>
                <p className="text-sm text-slate-700 mt-0.5 capitalize">{selectedLead.source.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Score</p>
                <p className={`text-sm font-semibold mt-0.5 ${getScoreColor(selectedLead.score)}`}>
                  {selectedLead.score} / 100 — {getScoreLabel(selectedLead.score)}
                </p>
                <div className="mt-1 w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      selectedLead.score <= 25 ? 'bg-red-500' :
                      selectedLead.score <= 50 ? 'bg-amber-500' :
                      selectedLead.score <= 75 ? 'bg-blue-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${selectedLead.score}%` }}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Assigned To</p>
                <p className="text-sm text-slate-700 mt-0.5">
                  {selectedLead.assignedTo ? `${selectedLead.assignedTo.firstName} ${selectedLead.assignedTo.lastName}` : '—'}
                </p>
              </div>
              {selectedLead.notes && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Notes</p>
                  <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{selectedLead.notes}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Created</p>
                <p className="text-sm text-slate-700 mt-0.5">{formatDate(selectedLead.createdAt)}</p>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <Button size="sm" variant="outline" onClick={() => { setDetailOpen(false); openEditSheet(selectedLead); }}>
                  Edit
                </Button>
                {selectedLead.status !== 'WON' && selectedLead.status !== 'LOST' && (
                  <Button size="sm" onClick={() => handleConvert(selectedLead)} disabled={saving}>
                    Convert to Customer
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => { setDetailOpen(false); setDeleteId(selectedLead.id); }}>
                  Delete
                </Button>
              </div>
            </div>
          )}
        </Sheet>
      )}

      {/* ─── Delete Confirmation ─────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <Heading as="h3" className="text-lg font-semibold text-slate-900">Delete Lead?</Heading>
            <Text variant="muted" className="mt-2">
              This action cannot be undone. The lead will be permanently removed.
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
