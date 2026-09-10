'use client';

import { useState, useCallback, useEffect } from 'react';
import DashboardShell from '@/components/DashboardShell';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
  Button, Badge, Heading, Text, Input, Textarea, Select, Sheet, Switch, Alert,
} from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AutomationFlow {
  id: string;
  name: string;
  description?: string;
  triggerType: string;
  conditions: Record<string, unknown>[];
  actions: Record<string, unknown>[];
  isActive: boolean;
  runCount: number;
  lastRunAt?: string;
  createdAt: string;
}

type BuilderStep = 'trigger' | 'conditions' | 'actions' | 'review';

interface BuilderState {
  name: string;
  description: string;
  triggerType: string;
  conditions: { field: string; operator: string; value: string }[];
  actions: { type: string; params: Record<string, string> }[];
  isActive: boolean;
}

// ─── Trigger Options ───────────────────────────────────────────────────────────

const TRIGGER_OPTIONS = [
  { value: 'new_lead', label: 'New Lead Created', icon: '👤', category: 'CRM' },
  { value: 'order_placed', label: 'Order Placed', icon: '🛒', category: 'E-Commerce' },
  { value: 'order_completed', label: 'Order Completed', icon: '✅', category: 'E-Commerce' },
  { value: 'abandoned_cart', label: 'Cart Abandoned', icon: '🛍️', category: 'E-Commerce' },
  { value: 'customer_signup', label: 'Customer Signed Up', icon: '📝', category: 'CRM' },
  { value: 'payment_received', label: 'Payment Received', icon: '💳', category: 'Finance' },
  { value: 'payment_failed', label: 'Payment Failed', icon: '❌', category: 'Finance' },
  { value: 'subscription_renewal', label: 'Subscription Renewal', icon: '🔄', category: 'Billing' },
  { value: 'subscription_cancelled', label: 'Subscription Cancelled', icon: '🚫', category: 'Billing' },
  { value: 'review_request', label: 'Review Request', icon: '⭐', category: 'Engagement' },
  { value: 'birthday', label: 'Birthday Trigger', icon: '🎂', category: 'Engagement' },
  { value: 'custom_event', label: 'Custom Event', icon: '⚡', category: 'Custom' },
] as const;

// ─── Action Options ───────────────────────────────────────────────────────────

const ACTION_OPTIONS = [
  { value: 'send_email', label: 'Send Email', icon: '📧', color: 'bg-sky-500' },
  { value: 'send_sms', label: 'Send SMS', icon: '📱', color: 'bg-emerald-500' },
  { value: 'send_whatsapp', label: 'Send WhatsApp', icon: '💬', color: 'bg-green-600' },
  { value: 'create_task', label: 'Create Task', icon: '📋', color: 'bg-amber-500' },
  { value: 'update_field', label: 'Update Field', icon: '✏️', color: 'bg-indigo-500' },
  { value: 'add_tag', label: 'Add Tag', icon: '🏷️', color: 'bg-violet-500' },
  { value: 'webhook', label: 'Fire Webhook', icon: '🔗', color: 'bg-slate-600' },
  { value: 'delay', label: 'Wait / Delay', icon: '⏱️', color: 'bg-slate-400' },
];

const OPERATOR_OPTIONS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'does not equal' },
  { value: 'gt', label: 'is greater than' },
  { value: 'lt', label: 'is less than' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
];

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    name: 'Welcome New Lead',
    icon: '👋',
    description: 'Send a welcome email when a new lead is created',
    triggerType: 'new_lead',
    actions: [{ type: 'send_email', params: { templateId: 'welcome-lead' } }],
  },
  {
    name: 'Post-Purchase Thank You',
    icon: '🙏',
    description: 'Thank the customer after their order is completed',
    triggerType: 'order_completed',
    actions: [{ type: 'send_email', params: { templateId: 'thank-you' } }],
  },
  {
    name: 'Cart Recovery',
    icon: '🛒',
    description: 'Remind customers about abandoned carts',
    triggerType: 'abandoned_cart',
    actions: [
      { type: 'delay', params: { duration: '1h' } },
      { type: 'send_email', params: { templateId: 'cart-recovery' } },
    ],
  },
  {
    name: 'Payment Failure Alert',
    icon: '⚠️',
    description: 'Alert team when a payment fails',
    triggerType: 'payment_failed',
    actions: [
      { type: 'send_email', params: { templateId: 'payment-alert' } },
      { type: 'create_task', params: { priority: 'high', title: 'Review failed payment' } },
    ],
  },
  {
    name: 'Birthday Offer',
    icon: '🎂',
    description: 'Send a special offer on customer birthday',
    triggerType: 'birthday',
    actions: [{ type: 'send_email', params: { templateId: 'birthday-offer' } }],
  },
  {
    name: 'Subscription Renewal Reminder',
    icon: '🔄',
    description: 'Remind customers before subscription renewal',
    triggerType: 'subscription_renewal',
    actions: [{ type: 'send_sms', params: { templateId: 'renewal-reminder' } }],
  },
];

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ type, message, onDone }: { type: 'success' | 'error'; message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className={`fixed top-6 right-6 z-[60] rounded-lg px-5 py-3 shadow-lg text-sm font-medium ${
        type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
      }`}
      role="alert"
    >
      {message}
    </div>
  );
}

// ─── Default Builder State ─────────────────────────────────────────────────────

const emptyBuilder = (): BuilderState => ({
  name: '',
  description: '',
  triggerType: '',
  conditions: [],
  actions: [],
  isActive: true,
});

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AutomationBuilderPage() {
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Builder sheet
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingFlow, setEditingFlow] = useState<AutomationFlow | null>(null);
  const [builder, setBuilder] = useState<BuilderState>(emptyBuilder());
  const [builderStep, setBuilderStep] = useState<BuilderStep>('trigger');
  const [saving, setSaving] = useState(false);

  // Test
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Gallery filter
  const [galleryFilter, setGalleryFilter] = useState<string>('all');

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // History
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<{ id: string; flowId: string; flowName: string; result: string; runAt: string }[]>([]);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Load flows ──────────────────────────────────────────────────────────────

  const loadFlows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/automation?tenantId=${TENANT_ID}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setFlows(Array.isArray(data) ? data : data.flows || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load automations.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  // ─── Builder helpers ────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingFlow(null);
    setBuilder(emptyBuilder());
    setBuilderStep('trigger');
    setShowBuilder(true);
  };

  const openEdit = (flow: AutomationFlow) => {
    setEditingFlow(flow);
    setBuilder({
      name: flow.name,
      description: flow.description || '',
      triggerType: flow.triggerType,
      conditions: Array.isArray(flow.conditions) ? flow.conditions as { field: string; operator: string; value: string }[] : [],
      actions: Array.isArray(flow.actions) ? flow.actions as { type: string; params: Record<string, string> }[] : [],
      isActive: flow.isActive,
    });
    setBuilderStep('trigger');
    setShowBuilder(true);
  };

  const loadTemplate = (tpl: typeof TEMPLATES[0]) => {
    setBuilder({
      name: tpl.name,
      description: tpl.description,
      triggerType: tpl.triggerType,
      conditions: [],
      actions: tpl.actions.map((a) => ({ type: a.type, params: a.params })),
      isActive: true,
    });
    setBuilderStep('review');
  };

  const addCondition = () => {
    setBuilder((b) => ({
      ...b,
      conditions: [...b.conditions, { field: '', operator: 'eq', value: '' }],
    }));
  };

  const updateCondition = (idx: number, patch: Partial<{ field: string; operator: string; value: string }>) => {
    setBuilder((b) => ({
      ...b,
      conditions: b.conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));
  };

  const removeCondition = (idx: number) => {
    setBuilder((b) => ({
      ...b,
      conditions: b.conditions.filter((_, i) => i !== idx),
    }));
  };

  const addAction = () => {
    setBuilder((b) => ({
      ...b,
      actions: [...b.actions, { type: 'send_email', params: { templateId: '' } }],
    }));
  };

  const updateAction = (idx: number, patch: Partial<{ type: string; params: Record<string, string> }>) => {
    setBuilder((b) => ({
      ...b,
      actions: b.actions.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }));
  };

  const removeAction = (idx: number) => {
    setBuilder((b) => ({
      ...b,
      actions: b.actions.filter((_, i) => i !== idx),
    }));
  };

  // ─── Save flow ──────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!builder.name.trim() || !builder.triggerType) {
      setToast({ type: 'error', message: 'Name and trigger type are required.' });
      return;
    }
    setSaving(true);
    try {
      const method = editingFlow ? 'PATCH' : 'POST';
      const url = editingFlow
        ? `${API_BASE}/api/automation/${editingFlow.id}`
        : `${API_BASE}/api/automation`;

      const body = {
        tenantId: TENANT_ID,
        name: builder.name,
        description: builder.description,
        triggerType: builder.triggerType,
        conditions: builder.conditions,
        actions: builder.actions,
        isActive: builder.isActive,
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
      setToast({ type: 'success', message: editingFlow ? 'Flow updated.' : 'Flow created.' });
      setShowBuilder(false);
      loadFlows();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save.';
      setToast({ type: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle flow ────────────────────────────────────────────────────────────

  const handleToggle = async (flow: AutomationFlow) => {
    try {
      const res = await fetch(`${API_BASE}/api/automation/${flow.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID, isActive: !flow.isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      setFlows((prev) => prev.map((f) => (f.id === flow.id ? { ...f, isActive: !f.isActive } : f)));
    } catch {
      // silent
    }
  };

  // ─── Test flow ──────────────────────────────────────────────────────────────

  const handleTest = async (flowId: string) => {
    setTestingId(flowId);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/automation/${flowId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setTestResult({ success: true, message: data.message || 'Test passed successfully.' });
      setFlows((prev) =>
        prev.map((f) =>
          f.id === flowId ? { ...f, runCount: (f.runCount || 0) + 1, lastRunAt: new Date().toISOString() } : f,
        ),
      );
      // Add to history
      const flow = flows.find((f) => f.id === flowId);
      setHistory((h) => [
        { id: crypto.randomUUID(), flowId, flowName: flow?.name || 'Unknown', result: 'success', runAt: new Date().toISOString() },
        ...h,
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Test failed.';
      setTestResult({ success: false, message });
      const flow = flows.find((f) => f.id === flowId);
      setHistory((h) => [
        { id: crypto.randomUUID(), flowId, flowName: flow?.name || 'Unknown', result: 'failed', runAt: new Date().toISOString() },
        ...h,
      ]);
    } finally {
      setTestingId(null);
    }
  };

  // ─── Delete flow ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/automation/${deleteId}?tenantId=${TENANT_ID}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      setToast({ type: 'success', message: 'Flow deleted.' });
      setDeleteId(null);
      loadFlows();
    } catch {
      // silent
    } finally {
      setDeleting(false);
    }
  };

  // ─── Step rendering helpers ──────────────────────────────────────────────────

  const getTriggerLabel = (type: string) => TRIGGER_OPTIONS.find((t) => t.value === type)?.label || type;

  const filteredTemplates = galleryFilter === 'all'
    ? TEMPLATES
    : TEMPLATES.filter((t) => {
        const triggerCat = TRIGGER_OPTIONS.find((tr) => tr.value === t.triggerType)?.category || 'Custom';
        return triggerCat.toLowerCase() === galleryFilter.toLowerCase();
      });

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Heading as="h1" className="text-2xl font-bold text-slate-900">Automation Builder</Heading>
            <Text variant="muted" className="mt-1">Build visual workflows: When [trigger] → Then [actions]</Text>
          </div>
          <Button onClick={openCreate}>+ New Automation</Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={loadFlows} className="underline font-medium">Retry</button>
          </div>
        )}

        {testResult && (
          <Alert variant={testResult.success ? 'success' : 'error'} title={testResult.success ? 'Test Passed' : 'Test Failed'}>
            {testResult.message}
          </Alert>
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

        {/* Flows list */}
        {!loading && !error && (
          flows.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-5xl">⚡</div>
              <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">No automations yet</Heading>
              <Text variant="muted" className="mt-2">Create your first automation or pick a template below.</Text>
              <div className="flex gap-3 mt-4 justify-center">
                <Button onClick={openCreate}>Create Automation</Button>
                <Button variant="outline" onClick={() => setShowHistory(false)}>Browse Templates</Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {flows.map((flow) => {
                const triggerDef = TRIGGER_OPTIONS.find((t) => t.value === flow.triggerType);
                return (
                  <Card key={flow.id} className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900">{flow.name}</p>
                          <Badge variant={flow.isActive ? 'success' : 'neutral'}>
                            {flow.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          {triggerDef && (
                            <Badge variant="info">
                              {triggerDef.icon} {triggerDef.label}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                          <span>{flow.actions.length} action(s)</span>
                          <span>{flow.conditions.length} condition(s)</span>
                          <span>Run: {flow.runCount || 0} times</span>
                          {flow.lastRunAt && <span>Last: {new Date(flow.lastRunAt).toLocaleString()}</span>}
                        </div>
                        {/* Mini visual flow */}
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400 overflow-x-auto">
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 whitespace-nowrap">When: {getTriggerLabel(flow.triggerType)}</span>
                          <span>→</span>
                          {flow.conditions.map((c, i) => (
                            <span key={i} className="flex items-center gap-1 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700">If: {String(c.field || '')}</span>
                              {i < flow.conditions.length - 1 && <span>AND</span>}
                            </span>
                          ))}
                          {flow.conditions.length > 0 && <span>→</span>}
                          {flow.actions.map((a, i) => (
                            <span key={i} className="flex items-center gap-1 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">{a.type}</span>
                              {i < flow.actions.length - 1 && <span>,</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleTest(flow.id)}
                          disabled={testingId === flow.id}
                        >
                          {testingId === flow.id ? 'Testing…' : '▶ Test'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(flow)}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowHistory(true)}>History</Button>
                        <Button size="sm" variant="destructive" onClick={() => setDeleteId(flow.id)}>Delete</Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {/* ── Template Gallery ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Template Gallery</CardTitle>
                <CardDescription>Start from a pre-built automation template</CardDescription>
              </div>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {['all', 'crm', 'e-commerce', 'finance', 'engagement'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setGalleryFilter(cat)}
                    className={`px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      galleryFilter === cat ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => loadTemplate(tpl)}
                  className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:shadow-md transition-all hover:border-indigo-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{tpl.icon}</span>
                    <p className="font-medium text-sm text-slate-900">{tpl.name}</p>
                  </div>
                  <Text variant="small" className="mt-1">{tpl.description}</Text>
                  <div className="flex items-center gap-1 mt-2">
                    <Badge variant="neutral" className="text-[10px]">{tpl.triggerType.replace('_', ' ')}</Badge>
                    <span className="text-xs text-slate-400">{tpl.actions.length} action(s)</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Execution History ────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Execution History</CardTitle>
            <CardDescription>Recent automation runs</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <Text variant="muted" className="text-sm">No executions yet. Test an automation to see results here.</Text>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Automation</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Result</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">Run At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.slice(0, 20).map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 text-sm text-slate-900">{h.flowName}</td>
                        <td className="px-3 py-2">
                          <Badge variant={h.result === 'success' ? 'success' : 'danger'}>
                            {h.result === 'success' ? 'Success' : 'Failed'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-slate-500">
                          {new Date(h.runAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Builder Sheet ──────────────────────────────────────────────────── */}

      <Sheet open={showBuilder} onClose={() => setShowBuilder(false)} title={editingFlow ? 'Edit Automation' : 'New Automation'}>
        <div className="space-y-5">
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {(['trigger', 'conditions', 'actions', 'review'] as BuilderStep[]).map((step) => (
              <button
                key={step}
                onClick={() => setBuilderStep(step)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                  builderStep === step
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {step}
              </button>
            ))}
          </div>

          {/* Step: Trigger */}
          {builderStep === 'trigger' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Name *</label>
                <Input
                  value={builder.name}
                  onChange={(e) => setBuilder({ ...builder, name: e.target.value })}
                  placeholder="e.g. Welcome New Leads"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                <Textarea
                  value={builder.description}
                  onChange={(e) => setBuilder({ ...builder, description: e.target.value })}
                  placeholder="What does this automation do?"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">Trigger *</label>
                <div className="grid grid-cols-2 gap-2">
                  {TRIGGER_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setBuilder({ ...builder, triggerType: t.value })}
                      className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors ${
                        builder.triggerType === t.value
                          ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{t.icon}</span>
                      <div>
                        <p className="font-medium text-slate-900 text-xs">{t.label}</p>
                        <p className="text-[10px] text-slate-400">{t.category}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={() => setBuilderStep('conditions')}>
                Next: Conditions →
              </Button>
            </div>
          )}

          {/* Step: Conditions */}
          {builderStep === 'conditions' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">Conditions (optional)</label>
                <div className="space-y-2">
                  {builder.conditions.map((cond, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={cond.field}
                        onChange={(e) => updateCondition(i, { field: e.target.value })}
                        placeholder="Field (e.g. lead.source)"
                        className="flex-1"
                      />
                      <select
                        value={cond.operator}
                        onChange={(e) => updateCondition(i, { operator: e.target.value })}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {OPERATOR_OPTIONS.map((op) => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                      <Input
                        value={cond.value}
                        onChange={(e) => updateCondition(i, { value: e.target.value })}
                        placeholder="Value"
                        className="w-24"
                      />
                      <button
                        onClick={() => removeCondition(i)}
                        className="text-red-500 hover:text-red-700 text-xs px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button onClick={addCondition} className="text-xs text-indigo-600 hover:underline">+ Add condition</button>
                </div>
                <Text variant="small" className="mt-2">All conditions must be met for the actions to run.</Text>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setBuilderStep('trigger')}>← Back</Button>
                <Button className="flex-1" onClick={() => setBuilderStep('actions')}>Next: Actions →</Button>
              </div>
            </div>
          )}

          {/* Step: Actions */}
          {builderStep === 'actions' && (
            <div className="space-y-4">
              <label className="block text-xs font-medium text-slate-500 mb-2">Actions (run in order)</label>
              <div className="space-y-2">
                {builder.actions.map((action, i) => {
                  const actionDef = ACTION_OPTIONS.find((a) => a.value === action.type);
                  return (
                    <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Step {i + 1}</span>
                        <button onClick={() => removeAction(i)} className="text-red-500 hover:text-red-700 text-xs">✕ Remove</button>
                      </div>
                      <select
                        value={action.type}
                        onChange={(e) => updateAction(i, { type: e.target.value })}
                        className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {ACTION_OPTIONS.map((a) => (
                          <option key={a.value} value={a.value}>{a.icon} {a.label}</option>
                        ))}
                      </select>
                      {action.type === 'send_email' && (
                        <Input
                          value={action.params.templateId || ''}
                          onChange={(e) => updateAction(i, { params: { ...action.params, templateId: e.target.value } })}
                          placeholder="Template ID"
                        />
                      )}
                      {action.type === 'delay' && (
                        <Input
                          value={action.params.duration || ''}
                          onChange={(e) => updateAction(i, { params: { ...action.params, duration: e.target.value } })}
                          placeholder="Duration (e.g. 1h, 30m, 1d)"
                        />
                      )}
                      {action.type === 'create_task' && (
                        <div className="space-y-2">
                          <Input
                            value={action.params.title || ''}
                            onChange={(e) => updateAction(i, { params: { ...action.params, title: e.target.value } })}
                            placeholder="Task title"
                          />
                          <select
                            value={action.params.priority || 'medium'}
                            onChange={(e) => updateAction(i, { params: { ...action.params, priority: e.target.value } })}
                            className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="low">Low Priority</option>
                            <option value="medium">Medium Priority</option>
                            <option value="high">High Priority</option>
                          </select>
                        </div>
                      )}
                      {action.type === 'webhook' && (
                        <Input
                          value={action.params.url || ''}
                          onChange={(e) => updateAction(i, { params: { ...action.params, url: e.target.value } })}
                          placeholder="Webhook URL"
                        />
                      )}
                    </div>
                  );
                })}
                <button onClick={addAction} className="text-xs text-indigo-600 hover:underline">+ Add action</button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setBuilderStep('conditions')}>← Back</Button>
                <Button className="flex-1" onClick={() => setBuilderStep('review')}>Next: Review →</Button>
              </div>
            </div>
          )}

          {/* Step: Review */}
          {builderStep === 'review' && (
            <div className="space-y-4">
              {/* Visual flow preview */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-xs font-medium text-slate-500 mb-3">Visual Flow Preview</p>
                <div className="flex flex-col gap-3">
                  {/* Trigger node */}
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-lg shadow-sm">
                      {TRIGGER_OPTIONS.find((t) => t.value === builder.triggerType)?.icon || '⚡'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">WHEN</p>
                      <p className="text-xs text-slate-500">{getTriggerLabel(builder.triggerType) || 'No trigger selected'}</p>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <svg className="h-6 w-6 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M19 12l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Conditions */}
                  {builder.conditions.length > 0 && (
                    <>
                      <div className="ml-4 flex flex-col gap-2">
                        {builder.conditions.map((c, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 text-sm">
                              ⚙️
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-500">IF</p>
                              <p className="text-sm text-slate-700">
                                {c.field || '?'} <span className="text-slate-400">{OPERATOR_OPTIONS.find((o) => o.value === c.operator)?.label || c.operator}</span> "{c.value || '?'}"
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-center">
                        <svg className="h-6 w-6 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14M19 12l-7 7-7-7" />
                        </svg>
                      </div>
                    </>
                  )}

                  {/* Actions */}
                  <div className="ml-4 flex flex-col gap-2">
                    {builder.actions.map((a, i) => {
                      const actionDef = ACTION_OPTIONS.find((o) => o.value === a.type);
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-xl ${actionDef?.color || 'bg-slate-500'} flex items-center justify-center text-white text-lg shadow-sm`}>
                            {actionDef?.icon || '⚡'}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500">THEN</p>
                            <p className="text-sm font-medium text-slate-900">{actionDef?.label || a.type}</p>
                            {Object.keys(a.params).length > 0 && (
                              <p className="text-xs text-slate-400">{Object.entries(a.params).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ')}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">Activate on save</p>
                  <Text variant="small">Enable this flow immediately after creation</Text>
                </div>
                <Switch checked={builder.isActive} onChange={(e) => setBuilder({ ...builder, isActive: e.target.checked })} />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setBuilderStep('actions')}>← Back</Button>
                <Button className="flex-1" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : editingFlow ? 'Update Flow' : 'Create Flow'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Sheet>

      {/* ─── Delete Confirmation ──────────────────────────────────────────────── */}

      <Sheet open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Automation">
        <div className="space-y-4">
          <Text>Are you sure you want to delete this automation? This action cannot be undone.</Text>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="flex-1">
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Sheet>

      {toast && <Toast type={toast.type} message={toast.message} onDone={() => setToast(null)} />}
    </>
  );
}
