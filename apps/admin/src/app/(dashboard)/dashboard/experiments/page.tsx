'use client';

import { useState, useCallback, useEffect } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { Heading, Text, Badge, Button, Card, Input, Label, Textarea, Select, Sheet, cn } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Types ────────────────────────────────────────────────────

type ExperimentStatus = 'draft' | 'active' | 'completed';

interface ExperimentVariant {
  id: string;
  name: string;
  conversionRate: number;
  sampleSize: number;
  isControl: boolean;
}

interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
  successMetric: string;
  confidence: number | null;
  winnerVariantId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface ExperimentForm {
  name: string;
  hypothesis: string;
  successMetric: string;
  variants: string;
}

// ─── Constants ───────────────────────────────────────────────

const STATUS_TABS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'draft', label: 'Draft' },
];

const METRIC_OPTIONS = [
  { value: 'conversion_rate', label: 'Conversion Rate' },
  { value: 'revenue_per_visitor', label: 'Revenue Per Visitor' },
  { value: 'click_through_rate', label: 'Click-Through Rate' },
  { value: 'signup_rate', label: 'Sign-Up Rate' },
  { value: 'checkout_completion', label: 'Checkout Completion' },
  { value: 'aov', label: 'Average Order Value' },
];

const STATUS_COLORS: Record<ExperimentStatus, 'success' | 'neutral' | 'info'> = {
  active: 'success',
  completed: 'neutral',
  draft: 'info',
};

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

const initialForm: ExperimentForm = {
  name: '',
  hypothesis: '',
  successMetric: 'conversion_rate',
  variants: '',
};

// ─── Page ────────────────────────────────────────────────────

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ExperimentStatus>('active');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultsFor, setResultsFor] = useState<Experiment | null>(null);
  const [resultsData, setResultsData] = useState<Record<string, unknown> | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [form, setForm] = useState<ExperimentForm>(initialForm);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadExperiments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/experiments?tenantId=${TENANT_ID}&status=${activeTab}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setExperiments(data.experiments || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load experiments.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const openCreateSheet = () => {
    setForm(initialForm);
    setSheetOpen(true);
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.hypothesis.trim()) {
      showToast('error', 'Name and hypothesis are required.');
      return;
    }
    const variantNames = form.variants
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
    if (variantNames.length < 2) {
      showToast('error', 'Provide at least 2 variant names (one per line).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/experiments?tenantId=${TENANT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          hypothesis: form.hypothesis,
          successMetric: form.successMetric,
          variants: variantNames.map((name, idx) => ({ name, isControl: idx === 0 })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Experiment created successfully.');
      setSheetOpen(false);
      loadExperiments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create experiment.';
      showToast('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const startExperiment = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/experiments/${id}/start?tenantId=${TENANT_ID}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('success', 'Experiment started.');
      loadExperiments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start experiment.';
      showToast('error', message);
    }
  };

  const stopExperiment = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/experiments/${id}/stop?tenantId=${TENANT_ID}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('success', 'Experiment stopped.');
      loadExperiments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to stop experiment.';
      showToast('error', message);
    }
  };

  const duplicateExperiment = async (exp: Experiment) => {
    try {
      const res = await fetch(`${API_BASE}/api/experiments/${exp.id}/duplicate?tenantId=${TENANT_ID}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('success', 'Experiment duplicated.');
      loadExperiments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to duplicate experiment.';
      showToast('error', message);
    }
  };

  const loadResults = async (exp: Experiment) => {
    setResultsFor(exp);
    setResultsData(null);
    setResultsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/experiments/${exp.id}/results?tenantId=${TENANT_ID}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResultsData(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load results.';
      showToast('error', message);
    } finally {
      setResultsLoading(false);
    }
  };

  const filtered = experiments;
  const activeCount = filtered.filter((e) => e.status === 'active').length;
  const draftCount = filtered.filter((e) => e.status === 'draft').length;
  const completedCount = filtered.filter((e) => e.status === 'completed').length;

  return (
    <DashboardShell
      sidebarProps={{
        logo: <span className="text-lg font-bold text-indigo-600">ZYRA</span>,
        navLinks: [
          { href: '/dashboard', label: 'Overview' },
          { href: '/dashboard/chat', label: 'Talk to ZYRA' },
          { href: '/dashboard/approvals', label: 'Approvals' },
          { href: '/dashboard/orders', label: 'Orders' },
          { href: '/dashboard/products', label: 'Products' },
          { href: '/dashboard/customers', label: 'Customers' },
          { href: '/dashboard/finance', label: 'Finance' },
          { href: '/dashboard/experiments', label: 'Experiments', active: true },
        ],
        user: { name: 'Admin', email: 'owner@demo.com', initials: 'A' },
      }}
      headerProps={{
        title: 'A/B Testing & Experiments',
        subtitle: 'Run experiments and optimize conversions',
        actions: (
          <Button size="sm" onClick={openCreateSheet}>
            + Create Experiment
          </Button>
        ),
      }}
    >
      <div className="space-y-6">
        {/* Error */}
        {error && !loading && (
          <Alert variant="error" title="Error loading experiments" description={error} />
        )}

        {/* Toast */}
        {toast && (
          <div
            className={cn(
              'fixed top-6 right-6 z-50 rounded-lg px-5 py-3 shadow-lg text-sm font-medium transition-all',
              toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            )}
            role="alert"
          >
            {toast.message}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active', count: activeCount, variant: 'success' as const },
            { label: 'Completed', count: completedCount, variant: 'neutral' as const },
            { label: 'Draft', count: draftCount, variant: 'info' as const },
            { label: 'Total', count: filtered.length, variant: 'default' as const },
          ].map((stat) => (
            <Card key={stat.label} className="p-4">
              <Text variant="small" className="text-slate-500">{stat.label}</Text>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stat.count}</p>
            </Card>
          ))}
        </div>

        {/* Tab buttons */}
        <div className="flex items-center gap-1 border-b border-slate-200">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value as ExperimentStatus)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 rounded-t-md',
                activeTab === tab.value
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              {tab.label}
              {tab.value === 'active' && activeCount > 0 && (
                <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">
                  {activeCount}
                </span>
              )}
              {tab.value === 'draft' && draftCount > 0 && (
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  {draftCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
                <div className="h-5 w-64 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-96 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        )}

        {/* Experiments list */}
        {!loading && !error && (
          <>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-5xl">🧪</div>
                <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">
                  No {activeTab} experiments
                </Heading>
                <Text variant="muted" className="mt-2 max-w-sm">
                  {activeTab === 'draft'
                    ? 'Create a new experiment to get started.'
                    : `Switch to Draft to create one.`}
                </Text>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((exp) => {
                  const winner = exp.variants.find((v) => v.id === exp.winnerVariantId);
                  const topVariant = exp.variants.reduce<ExperimentVariant | null>(
                    (best, v) => (!best || v.conversionRate > best.conversionRate) ? v : best,
                    null
                  );

                  return (
                    <Card key={exp.id} className="p-5">
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        {/* Experiment info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Heading as="h4" className="text-sm font-semibold text-slate-900">
                              {exp.name}
                            </Heading>
                            <Badge variant={STATUS_COLORS[exp.status]}>
                              {exp.status}
                            </Badge>
                            {exp.winnerVariantId && (
                              <Badge variant="success">
                                🏆 Winner: {winner?.name || '—'}
                              </Badge>
                            )}
                          </div>
                          <Text variant="small" className="mt-1">{exp.hypothesis}</Text>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span>Metric: <span className="font-medium text-slate-700">{exp.successMetric.replace(/_/g, ' ')}</span></span>
                            <span>Created: {formatDate(exp.createdAt)}</span>
                            {exp.startedAt && <span>Started: {formatDate(exp.startedAt)}</span>}
                            {exp.confidence != null && (
                              <span className={cn(
                                'font-medium',
                                exp.confidence >= 95 ? 'text-emerald-600' :
                                exp.confidence >= 80 ? 'text-amber-600' : 'text-red-600'
                              )}>
                                {exp.confidence}% confidence
                              </span>
                            )}
                          </div>

                          {/* Variants */}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {exp.variants.map((v) => (
                              <div
                                key={v.id}
                                className={cn(
                                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                                  v.isControl
                                    ? 'border-indigo-200 bg-indigo-50'
                                    : 'border-slate-200 bg-slate-50'
                                )}
                              >
                                <span className="font-medium text-slate-900">{v.name}</span>
                                {v.isControl && <Badge variant="default" className="text-xs">Control</Badge>}
                                {!v.isControl && v.conversionRate > 0 && (
                                  <span className="text-emerald-600 font-medium">
                                    {v.conversionRate.toFixed(1)}%
                                  </span>
                                )}
                                {v.conversionRate === 0 && v.isControl && (
                                  <span className="text-slate-400">—</span>
                                )}
                                <span className="text-slate-400">n={v.sampleSize.toLocaleString()}</span>
                                {topVariant && v.id === topVariant.id && !exp.winnerVariantId && (
                                  <Badge variant="warning" className="text-xs">Leading</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 items-center gap-2 lg:flex-col">
                          {exp.status === 'draft' && (
                            <Button size="sm" onClick={() => startExperiment(exp.id)}>
                              Start
                            </Button>
                          )}
                          {exp.status === 'active' && (
                            <Button size="sm" variant="destructive" onClick={() => stopExperiment(exp.id)}>
                              Stop
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => loadResults(exp)}
                          >
                            Results
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => duplicateExperiment(exp)}
                          >
                            Duplicate
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Experiment Sheet */}
      <Sheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setForm(initialForm); }}
        title="Create Experiment"
      >
        <div className="space-y-5">
          <div>
            <Label htmlFor="exp-name">Experiment Name</Label>
            <Input
              id="exp-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Homepage CTA Test"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="exp-hypothesis">Hypothesis</Label>
            <Textarea
              id="exp-hypothesis"
              value={form.hypothesis}
              onChange={(e) => setForm((f) => ({ ...f, hypothesis: e.target.value }))}
              placeholder="We believe that [change] will cause [result] because [rationale]."
              rows={3}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="exp-metric">Success Metric</Label>
            <Select
              id="exp-metric"
              value={form.successMetric}
              onChange={(e) => setForm((f) => ({ ...f, successMetric: e.target.value }))}
              options={METRIC_OPTIONS}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="exp-variants">Variants (one per line)</Label>
            <Textarea
              id="exp-variants"
              value={form.variants}
              onChange={(e) => setForm((f) => ({ ...f, variants: e.target.value }))}
              placeholder="Original CTA&#10;New CTA&#10;Video CTA"
              rows={4}
              className="mt-1.5 font-mono text-xs"
            />
            <Text variant="small" className="mt-1 text-slate-400">
              First line is the control. Each subsequent line is a variant.
            </Text>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setSheetOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Experiment'}
            </Button>
          </div>
        </div>
      </Sheet>

      {/* Results Sheet */}
      <Sheet
        open={!!resultsFor}
        onClose={() => { setResultsFor(null); setResultsData(null); }}
        title={resultsFor ? `Results: ${resultsFor.name}` : 'Results'}
      >
        <div className="space-y-4">
          {resultsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-slate-200 animate-pulse" />
              ))}
            </div>
          ) : resultsData ? (
            <div className="space-y-4">
              {resultsData.winnerVariantId && (
                <Alert variant="success" title="Experiment Complete" description={`Winner: ${resultsData.winnerVariantName || '—'} with ${resultsData.confidence ?? '—'}% confidence`} />
              )}
              {resultsData.results && Array.isArray(resultsData.results) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="pb-2 text-left font-medium text-slate-500">Variant</th>
                        <th className="pb-2 text-right font-medium text-slate-500">Conversions</th>
                        <th className="pb-2 text-right font-medium text-slate-500">Samples</th>
                        <th className="pb-2 text-right font-medium text-slate-500">Conv. Rate</th>
                        <th className="pb-2 text-right font-medium text-slate-500">Lift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(resultsData.results as Record<string, unknown>[]).map((row: Record<string, unknown>, idx: number) => (
                        <tr key={idx} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 text-slate-900 font-medium">{String(row.name || `Variant ${idx + 1}`)}</td>
                          <td className="py-2 text-right">{String(row.conversions ?? '—')}</td>
                          <td className="py-2 text-right">{String(row.sampleSize ?? '—')}</td>
                          <td className="py-2 text-right font-mono">{String(row.conversionRate ?? '—')}</td>
                          <td className="py-2 text-right">
                            {row.lift != null ? (
                              <span className={Number(row.lift) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                {Number(row.lift) >= 0 ? '+' : ''}{String(row.lift)}%
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!resultsData.results && (
                <Text variant="muted">No detailed results available yet.</Text>
              )}
            </div>
          ) : (
            <Text variant="muted">Select an experiment to view results.</Text>
          )}
        </div>
      </Sheet>
    </DashboardShell>
  );
}
