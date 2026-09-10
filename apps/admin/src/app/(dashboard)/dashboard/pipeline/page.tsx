'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Heading, Text, Badge, Button, Card, Input, Label, Select, Sheet, Tabs, TabPanel } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Pipeline = {
  id: string;
  name: string;
  description: string | null;
  stages: PipelineStage[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type PipelineStage = {
  id: string;
  name: string;
  order: number;
  pipelineId: string;
};

type Deal = {
  id: string;
  title: string;
  description: string | null;
  value: number;
  currency: string;
  stageId: string;
  stage?: PipelineStage;
  status: string;
  probability: number;
  expectedCloseDate: string | null;
  actualCloseDate: string | null;
  customerId: string;
  customer?: { id: string; firstName: string; lastName: string; email: string };
  leadId: string | null;
  companyId: string | null;
  company?: { id: string; name: string };
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaginatedDeals = {
  deals: Deal[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type PipelineStats = {
  totalDeals: number;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  winRate: number;
  wonDeals: number;
  lostDeals: number;
};

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type Company = {
  id: string;
  name: string;
};

type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const STATUS_COLORS: Record<string, 'success' | 'danger' | 'neutral' | 'warning' | 'info' | 'default'> = {
  OPEN: 'info',
  WON: 'success',
  LOST: 'danger',
  CLOSED: 'neutral',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  // Pipelines
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [loadingPipelines, setLoadingPipelines] = useState(true);

  // Deals
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [dealError, setDealError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<PipelineStats | null>(null);

  // Related data for dropdowns
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [leadsList, setLeadsList] = useState<Lead[]>([]);

  // Add deal sheet
  const [dealSheetOpen, setDealSheetOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [dealForm, setDealForm] = useState({
    title: '',
    description: '',
    value: 0,
    currency: 'USD',
    stageId: '',
    probability: 50,
    expectedCloseDate: '',
    customerId: '',
    leadId: '',
    companyId: '',
    notes: '',
  });
  const [savingDeal, setSavingDeal] = useState(false);

  // Move stage dropdown state
  const [moveDealId, setMoveDealId] = useState<string | null>(null);

  // Delete
  const [deleteDealId, setDeleteDealId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Toast helper ────────────────────────────────────────────────────────────

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Load pipelines ──────────────────────────────────────────────────────────

  const loadPipelines = useCallback(async () => {
    setLoadingPipelines(true);
    try {
      const res = await fetch(`${API_BASE}/api/pipeline?tenantId=${TENANT_ID}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: Pipeline[] = await res.json();
      setPipelines(Array.isArray(data) ? data : []);
      if (data.length > 0 && !selectedPipelineId) {
        setSelectedPipelineId(data[0].id);
      }
    } catch {
      showToast('error', 'Failed to load pipelines.');
    } finally {
      setLoadingPipelines(false);
    }
  }, [selectedPipelineId, showToast]);

  // ─── Load related data ───────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [custRes, compRes, leadsRes] = await Promise.all([
          fetch(`${API_BASE}/api/customers?tenantId=${TENANT_ID}`),
          fetch(`${API_BASE}/api/companies?tenantId=${TENANT_ID}`),
          fetch(`${API_BASE}/api/leads?tenantId=${TENANT_ID}`),
        ]);
        if (custRes.ok) { const d = await custRes.json(); setCustomers(Array.isArray(d) ? d : (d.customers || [])); }
        if (compRes.ok) { const d = await compRes.json(); setCompanies(Array.isArray(d) ? d : (d.companies || [])); }
        if (leadsRes.ok) { const d = await leadsRes.json(); setLeadsList(Array.isArray(d) ? d : (d.leads || [])); }
      } catch { /* silently ignore */ }
    })();
  }, []);

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  // ─── Load deals ──────────────────────────────────────────────────────────────

  const loadDeals = useCallback(async () => {
    if (!selectedPipelineId) return;
    setLoadingDeals(true);
    setDealError(null);
    try {
      const params = new URLSearchParams({ tenantId: TENANT_ID, stageId: selectedPipelineId });
      const res = await fetch(`${API_BASE}/api/deals?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: PaginatedDeals = await res.json();
      setDeals(data.deals || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load deals.';
      setDealError(message);
    } finally {
      setLoadingDeals(false);
    }
  }, [selectedPipelineId]);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  // ─── Load stats ──────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/deals/stats?tenantId=${TENANT_ID}`);
      if (res.ok) {
        const data: PipelineStats = await res.json();
        setStats(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // ─── Create pipeline if none ─────────────────────────────────────────────────

  const ensurePipeline = async () => {
    if (pipelines.length > 0) return;
    try {
      const res = await fetch(`${API_BASE}/api/pipeline?tenantId=${TENANT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: TENANT_ID,
          name: 'Default Pipeline',
          description: 'Default sales pipeline',
          stages: [
            { name: 'New' },
            { name: 'Contacted' },
            { name: 'Qualified' },
            { name: 'Proposal' },
            { name: 'Negotiation' },
            { name: 'Won' },
            { name: 'Lost' },
          ],
        }),
      });
      if (res.ok) {
        const data: Pipeline = await res.json();
        setPipelines([data]);
        setSelectedPipelineId(data.id);
      }
    } catch { /* ignore */ }
  };

  const handleCreatePipeline = async () => {
    await ensurePipeline();
    await loadPipelines();
  };

  // ─── Open add deal sheet ─────────────────────────────────────────────────────

  const openAddDealSheet = () => {
    if (!selectedPipelineId) {
      ensurePipeline().then(() => {
        setDealForm({
          title: '',
          description: '',
          value: 0,
          currency: 'USD',
          stageId: '',
          probability: 50,
          expectedCloseDate: '',
          customerId: '',
          leadId: '',
          companyId: '',
          notes: '',
        });
        setEditingDeal(null);
        setDealSheetOpen(true);
      });
      return;
    }
    const currentPipeline = pipelines.find((p) => p.id === selectedPipelineId);
    const firstStage = currentPipeline?.stages?.[0]?.id || '';
    setEditingDeal(null);
    setDealForm({
      title: '',
      description: '',
      value: 0,
      currency: 'USD',
      stageId: firstStage,
      probability: 50,
      expectedCloseDate: '',
      customerId: '',
      leadId: '',
      companyId: '',
      notes: '',
    });
    setDealSheetOpen(true);
  };

  // ─── Open edit deal sheet ────────────────────────────────────────────────────

  const openEditDealSheet = (deal: Deal) => {
    setEditingDeal(deal);
    setDealForm({
      title: deal.title,
      description: deal.description || '',
      value: deal.value,
      currency: deal.currency,
      stageId: deal.stageId,
      probability: deal.probability,
      expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.slice(0, 10) : '',
      customerId: deal.customerId,
      leadId: deal.leadId || '',
      companyId: deal.companyId || '',
      notes: deal.notes || '',
    });
    setDealSheetOpen(true);
  };

  // ─── Submit deal ─────────────────────────────────────────────────────────────

  const handleDealSubmit = async () => {
    if (!dealForm.title.trim()) {
      showToast('error', 'Deal title is required.');
      return;
    }
    if (!selectedPipelineId) {
      showToast('error', 'Please select or create a pipeline first.');
      return;
    }

    setSavingDeal(true);
    try {
      const payload = {
        tenantId: TENANT_ID,
        title: dealForm.title.trim(),
        description: dealForm.description.trim() || null,
        value: Number(dealForm.value),
        currency: dealForm.currency,
        stageId: dealForm.stageId,
        probability: Number(dealForm.probability),
        expectedCloseDate: dealForm.expectedCloseDate || null,
        customerId: dealForm.customerId || null,
        leadId: dealForm.leadId || null,
        companyId: dealForm.companyId || null,
        notes: dealForm.notes.trim() || null,
        pipelineId: selectedPipelineId,
      };

      const url = editingDeal
        ? `${API_BASE}/api/deals/${editingDeal.id}?tenantId=${TENANT_ID}`
        : `${API_BASE}/api/deals?tenantId=${TENANT_ID}`;

      const res = await fetch(url, {
        method: editingDeal ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      showToast('success', editingDeal ? 'Deal updated successfully.' : 'Deal created successfully.');
      setDealSheetOpen(false);
      loadDeals();
      loadStats();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save deal.';
      showToast('error', message);
    } finally {
      setSavingDeal(false);
    }
  };

  // ─── Move deal stage ─────────────────────────────────────────────────────────

  const handleMoveStage = async (deal: Deal, stageId: string) => {
    const stage = getCurrentPipeline()?.stages.find((s) => s.id === stageId);
    if (!stage) return;
    try {
      const res = await fetch(`${API_BASE}/api/deals/${deal.id}/move?tenantId=${TENANT_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId, stageName: stage.name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', `Deal moved to ${stage.name}.`);
      setMoveDealId(null);
      loadDeals();
      loadStats();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to move deal.';
      showToast('error', message);
    }
  };

  // ─── Delete deal ─────────────────────────────────────────────────────────────

  const handleDeleteDeal = async () => {
    if (!deleteDealId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/deals/${deleteDealId}?tenantId=${TENANT_ID}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Deal deleted.');
      setDeleteDealId(null);
      loadDeals();
      loadStats();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete deal.';
      showToast('error', message);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Get current pipeline ────────────────────────────────────────────────────

  const getCurrentPipeline = () => pipelines.find((p) => p.id === selectedPipelineId);

  // ─── Group deals by stage ────────────────────────────────────────────────────

  const currentPipeline = getCurrentPipeline();
  const stages = currentPipeline?.stages?.sort((a, b) => a.order - b.order) || [];
  const dealsByStage: Record<string, Deal[]> = {};
  stages.forEach((stage) => {
    dealsByStage[stage.id] = deals.filter((d) => d.stageId === stage.id);
  });

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Heading as="h2" className="text-2xl font-bold text-slate-900">Sales Pipeline</Heading>
            <Text variant="muted" className="mt-1">Track deals through your sales funnel</Text>
          </div>
          <div className="flex gap-2">
            {pipelines.length === 0 ? (
              <Button onClick={handleCreatePipeline}>+ Create Pipeline</Button>
            ) : (
              <>
                <Select
                  value={selectedPipelineId}
                  onChange={(e) => setSelectedPipelineId(e.target.value)}
                  options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
                  className="w-full sm:w-56"
                />
                <Button onClick={openAddDealSheet}>+ Add Deal</Button>
              </>
            )}
          </div>
        </div>

        {/* Stats footer */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-4">
              <Text variant="muted" className="text-xs">Total Deals</Text>
              <p className="mt-1 text-lg font-bold text-slate-900">{stats.totalDeals}</p>
            </Card>
            <Card className="p-4">
              <Text variant="muted" className="text-xs">Pipeline Value</Text>
              <p className="mt-1 text-lg font-bold text-indigo-700">{formatCurrency(stats.totalPipelineValue)}</p>
            </Card>
            <Card className="p-4">
              <Text variant="muted" className="text-xs">Weighted Value</Text>
              <p className="mt-1 text-lg font-bold text-blue-700">{formatCurrency(stats.weightedPipelineValue)}</p>
            </Card>
            <Card className="p-4">
              <Text variant="muted" className="text-xs">Win Rate</Text>
              <p className="mt-1 text-lg font-bold text-emerald-700">
                {stats.totalDeals > 0 ? `${((stats.wonDeals / stats.totalDeals) * 100).toFixed(1)}%` : '—'}
              </p>
            </Card>
          </div>
        )}

        {/* Error */}
        {dealError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {dealError}
            <button onClick={loadDeals} className="ml-3 underline font-medium">Retry</button>
          </div>
        )}

        {/* Loading */}
        {loadingDeals && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-6 w-24 rounded bg-slate-200 animate-pulse" />
                <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                  <div className="h-4 w-20 rounded bg-slate-200" />
                  <div className="h-3 w-16 rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pipeline board */}
        {!loadingDeals && !dealError && pipelines.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
            {stages.map((stage) => {
              const stageDeals = dealsByStage[stage.id] || [];
              const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0);
              return (
                <div key={stage.id} className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stage.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">{stageDeals.length}</Badge>
                      <span className="text-xs text-slate-400">{formatCurrency(stageValue)}</span>
                    </div>
                  </div>
                  <div className="space-y-2 min-h-[120px] rounded-xl border border-dashed border-slate-200 bg-slate-50/30 p-2">
                    {stageDeals.length === 0 ? (
                      <Text variant="muted" className="text-xs text-center py-6 block">No deals</Text>
                    ) : (
                      stageDeals.map((deal) => (
                        <Card key={deal.id} className="p-3 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900 leading-tight">{deal.title}</p>
                            <div className="relative shrink-0">
                              <button
                                onClick={() => setMoveDealId(moveDealId === deal.id ? null : deal.id)}
                                className="text-xs text-slate-400 hover:text-indigo-600 px-1 rounded"
                                title="Move to stage"
                              >
                                ⋯
                              </button>
                              {moveDealId === deal.id && (
                                <div className="absolute right-0 top-6 z-20 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                                  {stages
                                    .filter((s) => s.id !== deal.stageId)
                                    .map((s) => (
                                      <button
                                        key={s.id}
                                        onClick={() => handleMoveStage(deal, s.id)}
                                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                                      >
                                        → {s.name}
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {deal.customer ? `${deal.customer.firstName} ${deal.customer.lastName}` : deal.company?.name || '—'}
                          </p>
                          <p className="text-sm font-semibold text-indigo-700 mt-1.5">{formatCurrency(deal.value, deal.currency)}</p>
                          {/* Probability bar */}
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5">
                              <span>Probability</span>
                              <span>{deal.probability}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-indigo-500"
                                style={{ width: `${deal.probability}%` }}
                              />
                            </div>
                          </div>
                          {deal.expectedCloseDate && (
                            <p className="text-xs text-slate-400 mt-1.5">
                              📅 {formatDate(deal.expectedCloseDate)}
                            </p>
                          )}
                          <div className="mt-2 flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEditDealSheet(deal)} className="text-xs px-2 py-1">
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteDealId(deal.id)} className="text-xs px-2 py-1 text-red-600">
                              Delete
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loadingDeals && !dealError && pipelines.length === 0 && (
          <Card className="p-12 text-center">
            <div className="text-5xl">🏗️</div>
            <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">No pipeline yet</Heading>
            <Text variant="muted" className="mt-2">Create your first sales pipeline to get started.</Text>
            <Button className="mt-4" onClick={handleCreatePipeline}>Create Pipeline</Button>
          </Card>
        )}

        {!loadingDeals && !dealError && pipelines.length > 0 && deals.length === 0 && (
          <Card className="p-12 text-center">
            <div className="text-5xl">📭</div>
            <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">No deals yet</Heading>
            <Text variant="muted" className="mt-2">Add your first deal to start tracking your pipeline.</Text>
            <Button className="mt-4" onClick={openAddDealSheet}>+ Add Deal</Button>
          </Card>
        )}
      </div>

      {/* ─── Add/Edit Deal Sheet ─────────────────────────────────────────────── */}
      <Sheet
        open={dealSheetOpen}
        onClose={() => setDealSheetOpen(false)}
        side="right"
        title={editingDeal ? 'Edit Deal' : 'Add New Deal'}
      >
        <div className="space-y-4">
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Title *</Label>
            <Input
              value={dealForm.title}
              onChange={(e) => setDealForm({ ...dealForm, title: e.target.value })}
              placeholder="Enterprise deal with Acme Corp"
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Description</Label>
            <textarea
              value={dealForm.description}
              onChange={(e) => setDealForm({ ...dealForm, description: e.target.value })}
              rows={3}
              placeholder="Deal description…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="block text-sm font-medium text-slate-700 mb-1">Value ($) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={dealForm.value}
                onChange={(e) => setDealForm({ ...dealForm, value: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-slate-700 mb-1">Probability (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={dealForm.probability}
                onChange={(e) => setDealForm({ ...dealForm, probability: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Stage</Label>
            <Select
              value={dealForm.stageId}
              onChange={(e) => setDealForm({ ...dealForm, stageId: e.target.value })}
              options={[
                { value: '', label: 'Select a stage…' },
                ...stages.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Customer</Label>
            <Select
              value={dealForm.customerId}
              onChange={(e) => setDealForm({ ...dealForm, customerId: e.target.value })}
              options={[
                { value: '', label: 'Select a customer…' },
                ...customers.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName} (${c.email})` })),
              ]}
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Lead</Label>
            <Select
              value={dealForm.leadId}
              onChange={(e) => setDealForm({ ...dealForm, leadId: e.target.value })}
              options={[
                { value: '', label: 'Select a lead…' },
                ...leadsList.map((l) => ({ value: l.id, label: `${l.firstName} ${l.lastName}` })),
              ]}
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Company</Label>
            <Select
              value={dealForm.companyId}
              onChange={(e) => setDealForm({ ...dealForm, companyId: e.target.value })}
              options={[
                { value: '', label: 'Select a company…' },
                ...companies.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Expected Close Date</Label>
            <Input
              type="date"
              value={dealForm.expectedCloseDate}
              onChange={(e) => setDealForm({ ...dealForm, expectedCloseDate: e.target.value })}
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-1">Notes</Label>
            <textarea
              value={dealForm.notes}
              onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })}
              rows={2}
              placeholder="Deal notes…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleDealSubmit} disabled={savingDeal} className="flex-1">
              {savingDeal ? 'Saving…' : editingDeal ? 'Update Deal' : 'Add Deal'}
            </Button>
            <Button variant="outline" onClick={() => setDealSheetOpen(false)} disabled={savingDeal}>Cancel</Button>
          </div>
        </div>
      </Sheet>

      {/* ─── Delete Confirmation ─────────────────────────────────────────────── */}
      {deleteDealId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <Heading as="h3" className="text-lg font-semibold text-slate-900">Delete Deal?</Heading>
            <Text variant="muted" className="mt-2">
              This action cannot be undone. The deal will be permanently removed.
            </Text>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteDealId(null)} disabled={deleting}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteDeal} disabled={deleting}>
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
