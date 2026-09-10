'use client';

import { useState, useCallback, useEffect } from 'react';
import { Heading, Text, Badge, Button, Card, Input, Sheet, Switch } from '@zyra/ui';

const API_BASE = 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

const TRIGGER_TYPES = [
  'new_lead',
  'order_placed',
  'order_completed',
  'abandoned_cart',
  'customer_signup',
  'subscription_renewal',
  'subscription_cancelled',
  'payment_received',
  'payment_failed',
  'review_request',
  'birthday',
  'custom',
] as const;

type AutomationRule = {
  id: string;
  name: string;
  triggerType: string;
  isActive: boolean;
  actions: Record<string, unknown>;
  runCount: number;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form sheet
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [formName, setFormName] = useState('');
  const [formTrigger, setFormTrigger] = useState('new_lead');
  const [formActions, setFormActions] = useState('{\n  "type": "send_email",\n  "templateId": "",\n  "channel": "EMAIL"\n}');
  const [saving, setSaving] = useState(false);

  // Trigger modal
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Load rules ─────────────────────────────────────────────────────────────

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/communications/automation/rules?tenantId=${TENANT_ID}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setRules(Array.isArray(data) ? data : data.rules || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load automation rules.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // ─── Open form ──────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingRule(null);
    setFormName('');
    setFormTrigger('new_lead');
    setFormActions('{\n  "type": "send_email",\n  "templateId": "",\n  "channel": "EMAIL"\n}');
    setShowForm(true);
  };

  const openEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormTrigger(rule.triggerType);
    setFormActions(JSON.stringify(rule.actions || {}, null, 2));
    setShowForm(true);
  };

  // ─── Save rule ──────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!formName.trim()) {
      showToast('error', 'Rule name is required.');
      return;
    }
    let actions: Record<string, unknown> = {};
    try {
      actions = JSON.parse(formActions);
    } catch {
      showToast('error', 'Invalid JSON in actions config.');
      return;
    }

    setSaving(true);
    try {
      const method = editingRule ? 'PATCH' : 'POST';
      const url = editingRule
        ? `${API_BASE}/api/communications/automation/rules/${editingRule.id}`
        : `${API_BASE}/api/communications/automation/rules`;

      const body = {
        tenantId: TENANT_ID,
        name: formName,
        triggerType: formTrigger,
        actions,
        isActive: editingRule ? editingRule.isActive : true,
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
      showToast('success', editingRule ? 'Rule updated.' : 'Rule created.');
      setShowForm(false);
      loadRules();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save rule.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle active ──────────────────────────────────────────────────────────

  const handleToggle = async (rule: AutomationRule) => {
    try {
      const res = await fetch(`${API_BASE}/api/communications/automation/rules/${rule.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID, isActive: !rule.isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r)));
      showToast('success', `Rule ${!rule.isActive ? 'activated' : 'deactivated'}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to toggle rule.';
      showToast('error', message);
    }
  };

  // ─── Trigger rule manually ──────────────────────────────────────────────────

  const handleTrigger = async (rule: AutomationRule) => {
    setTriggeringId(rule.id);
    setTriggering(true);
    try {
      const res = await fetch(`${API_BASE}/api/communications/automation/rules/${rule.id}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setRules((prev) =>
        prev.map((r) =>
          r.id === rule.id ? { ...r, runCount: (r.runCount || 0) + 1, lastRunAt: new Date().toISOString() } : r,
        ),
      );
      showToast('success', `Rule triggered. ${data.executedCount || 0} actions executed.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to trigger rule.';
      showToast('error', message);
    } finally {
      setTriggering(false);
      setTriggeringId(null);
    }
  };

  // ─── Delete rule ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/communications/automation/rules/${deleteId}?tenantId=${TENANT_ID}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Rule deleted.');
      setDeleteId(null);
      loadRules();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete rule.';
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
            <Heading as="h1" className="text-2xl font-bold text-slate-900">Automation</Heading>
            <Text variant="muted" className="mt-1">Configure automation rules triggered by business events</Text>
          </div>
          <Button onClick={openCreate}>+ New Rule</Button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={loadRules} className="ml-3 underline font-medium">Retry</button>
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

        {/* Rules list */}
        {!loading && !error && (
          rules.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <div className="text-5xl">⚡</div>
              <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">No automation rules</Heading>
              <Text variant="muted" className="mt-2">Create a rule to automate repetitive communications.</Text>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <Card key={rule.id} className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-900">{rule.name}</p>
                        <Badge variant={rule.isActive ? 'success' : 'neutral'}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="info">{rule.triggerType}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                        <span>Triggered: {rule.runCount || 0} times</span>
                        {rule.lastRunAt && <span>Last run: {formatDateTime(rule.lastRunAt)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Switch
                        checked={rule.isActive}
                        onChange={() => handleToggle(rule)}
                      />
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleTrigger(rule)}
                        disabled={triggering && triggeringId === rule.id}
                      >
                        {triggering && triggeringId === rule.id ? 'Firing…' : 'Trigger'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(rule)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleteId(rule.id)}>Delete</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}
      </div>

      {/* ─── Create/Edit Form Sheet ───────────────────────────────────────────── */}

      <Sheet open={showForm} onClose={() => setShowForm(false)} title={editingRule ? 'Edit Rule' : 'New Automation Rule'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Rule Name *</label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Welcome new leads" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Trigger Type</label>
            <select
              value={formTrigger}
              onChange={(e) => setFormTrigger(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {TRIGGER_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Actions (JSON)</label>
            <textarea
              value={formActions}
              onChange={(e) => setFormActions(e.target.value)}
              rows={10}
              placeholder='[{"type": "send_email", "templateId": "..."}]'
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving…' : editingRule ? 'Update Rule' : 'Create Rule'}
          </Button>
        </div>
      </Sheet>

      {/* ─── Delete Confirmation Sheet ────────────────────────────────────────── */}

      <Sheet open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Rule">
        <div className="space-y-4">
          <Text>Are you sure you want to delete this automation rule? This action cannot be undone.</Text>
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

function formatDateTime(iso: string) {
  return iso
    ? new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
}
