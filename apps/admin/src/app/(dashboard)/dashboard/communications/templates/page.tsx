'use client';

import { useState, useCallback, useEffect } from 'react';
import { Heading, Text, Badge, Button, Card, Input, Sheet } from '@zyra/ui';

const API_BASE = 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

const TEMPLATE_TYPES = ['EMAIL', 'SMS', 'WHATSAPP'] as const;

const TYPE_COLORS: Record<string, 'info' | 'success' | 'neutral' | 'default'> = {
  EMAIL: 'info',
  SMS: 'success',
  WHATSAPP: 'success',
};

type Template = {
  id: string;
  name: string;
  type: string;
  subject?: string;
  body: string;
  variables: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form sheet
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('EMAIL');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formVariables, setFormVariables] = useState('{}');
  const [formDefault, setFormDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Load templates ─────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/communications/templates?tenantId=${TENANT_ID}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : data.templates || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load templates.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ─── Open form ──────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormType('EMAIL');
    setFormSubject('');
    setFormBody('');
    setFormVariables('{}');
    setFormDefault(false);
    setShowForm(true);
  };

  const openEdit = (tpl: Template) => {
    setEditingTemplate(tpl);
    setFormName(tpl.name);
    setFormType(tpl.type);
    setFormSubject(tpl.subject || '');
    setFormBody(tpl.body);
    setFormVariables(JSON.stringify(tpl.variables || {}, null, 2));
    setFormDefault(tpl.isDefault);
    setShowForm(true);
  };

  // ─── Save template ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!formName.trim()) {
      showToast('error', 'Template name is required.');
      return;
    }
    let variables: Record<string, unknown> = {};
    try {
      variables = JSON.parse(formVariables);
    } catch {
      showToast('error', 'Invalid JSON in variables field.');
      return;
    }

    setSaving(true);
    try {
      const method = editingTemplate ? 'PATCH' : 'POST';
      const url = editingTemplate
        ? `${API_BASE}/api/communications/templates/${editingTemplate.id}`
        : `${API_BASE}/api/communications/templates`;

      const body = {
        tenantId: TENANT_ID,
        name: formName,
        type: formType,
        subject: formType === 'EMAIL' ? formSubject : undefined,
        body: formBody,
        variables,
        isDefault: formDefault,
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
      showToast('success', editingTemplate ? 'Template updated.' : 'Template created.');
      setShowForm(false);
      loadTemplates();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save template.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete template ────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/communications/templates/${deleteId}?tenantId=${TENANT_ID}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Template deleted.');
      setDeleteId(null);
      loadTemplates();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete template.';
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

  const countVariables = (vars: Record<string, unknown>) => Object.keys(vars).length;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Heading as="h1" className="text-2xl font-bold text-slate-900">Templates</Heading>
            <Text variant="muted" className="mt-1">Manage message templates for campaigns and automations</Text>
          </div>
          <Button onClick={openCreate}>+ New Template</Button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={loadTemplates} className="ml-3 underline font-medium">Retry</button>
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

        {/* Templates table */}
        {!loading && !error && (
          templates.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <div className="text-5xl">📄</div>
              <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">No templates yet</Heading>
              <Text variant="muted" className="mt-2">Create your first message template to get started.</Text>
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Subject</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Variables</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {templates.map((tpl) => (
                      <tr key={tpl.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900">{tpl.name}</p>
                            {tpl.isDefault && <Badge variant="default">Default</Badge>}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">ID: {tpl.id.slice(0, 12)}…</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={TYPE_COLORS[tpl.type] || 'neutral'}>{tpl.type}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs max-w-[200px] truncate">
                          {tpl.subject || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {countVariables(tpl.variables || {})} vars
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEdit(tpl)}>Edit</Button>
                            {!tpl.isDefault && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteId(tpl.id)}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        )}
      </div>

      {/* ─── Create/Edit Form Sheet ───────────────────────────────────────────── */}

      <Sheet open={showForm} onClose={() => setShowForm(false)} title={editingTemplate ? 'Edit Template' : 'New Template'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Name *</label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Template name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {TEMPLATE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {formType === 'EMAIL' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
              <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="Email subject" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Body</label>
            <textarea
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              rows={6}
              placeholder="Template body. Use {{variableName}} for dynamic values."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Variables (JSON)</label>
            <textarea
              value={formVariables}
              onChange={(e) => setFormVariables(e.target.value)}
              rows={4}
              placeholder='{"customerName": "string", "orderId": "string"}'
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={formDefault}
              onChange={(e) => setFormDefault(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
            />
            <label htmlFor="isDefault" className="text-sm text-slate-700 cursor-pointer select-none">Default template</label>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving…' : editingTemplate ? 'Update Template' : 'Create Template'}
          </Button>
        </div>
      </Sheet>

      {/* ─── Delete Confirmation Sheet ────────────────────────────────────────── */}

      <Sheet open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Template">
        <div className="space-y-4">
          <Text>Are you sure you want to delete this template? This action cannot be undone.</Text>
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
