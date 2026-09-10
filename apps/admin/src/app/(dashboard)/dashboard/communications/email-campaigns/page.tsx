'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Heading, Text, Badge, Button, Card, Input, Sheet } from '@zyra/ui';

const API_BASE = 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

type EmailCampaign = {
  id: string;
  campaignId: string;
  campaign?: { name: string; type: string };
  subject: string;
  fromEmail: string;
  templateId?: string;
  body?: string;
  status: string;
  sentAt?: string;
  openCount: number;
  clickCount: number;
  bounceCount: number;
  unsubscribeCount: number;
};

type PaginatedEmailCampaigns = {
  emailCampaigns: EmailCampaign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const STATUS_COLORS: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  DRAFT: 'neutral',
  QUEUED: 'warning',
  SENDING: 'info',
  SENT: 'success',
  DELIVERED: 'success',
  BOUNCED: 'danger',
  FAILED: 'danger',
};

const formatDateTime = (iso: string) =>
  iso
    ? new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

// ─── Component ─────────────────────────────────────────────────────────────────

export default function EmailCampaignsPage() {
  const [emailCampaigns, setEmailCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Create sheet
  const [showForm, setShowForm] = useState(false);
  const [formSubject, setFormSubject] = useState('');
  const [formFromEmail, setFormFromEmail] = useState('');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formBody, setFormBody] = useState('');
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Test send
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Load email campaigns ────────────────────────────────────────────────────

  const loadEmailCampaigns = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tenantId: TENANT_ID,
        page: String(pageNum),
        limit: String(limit),
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`${API_BASE}/api/communications/email-campaigns?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: PaginatedEmailCampaigns = await res.json();
      setEmailCampaigns(data.emailCampaigns || []);
      setPage(data.page || pageNum);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load email campaigns.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, limit]);

  useEffect(() => {
    loadEmailCampaigns(1);
  }, [loadEmailCampaigns]);

  // ─── Load templates for select ──────────────────────────────────────────────

  useEffect(() => {
    if (showForm) {
      fetch(`${API_BASE}/api/communications/templates?tenantId=${TENANT_ID}&type=EMAIL`)
        .then((r) => r.json())
        .then((data: Template[]) => {
          const templates = Array.isArray(data) ? data : [];
          setTemplates(templates.map((t) => ({ id: t.id, name: t.name })));
        })
        .catch(() => {});
    }
  }, [showForm]);

  // ─── Search ─────────────────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (!value.trim()) { loadEmailCampaigns(1); return; }
      setLoading(true);
      fetch(`${API_BASE}/api/communications/email-campaigns?${new URLSearchParams({ tenantId: TENANT_ID, limit: '50' })}`)
        .then((r) => r.json())
        .then((data: PaginatedEmailCampaigns) => {
          const q = value.toLowerCase();
          const filtered = (data.emailCampaigns || []).filter((ec) =>
            ec.subject.toLowerCase().includes(q) || ec.fromEmail.toLowerCase().includes(q)
          );
          setEmailCampaigns(filtered);
          setTotalPages(1);
          setTotal(filtered.length);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 400);
  };

  // ─── Create email campaign ───────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!formSubject.trim() || !formFromEmail.trim()) {
      showToast('error', 'Subject and from email are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/communications/email-campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: TENANT_ID,
          subject: formSubject,
          fromEmail: formFromEmail,
          templateId: formTemplateId || undefined,
          body: formBody,
          campaignId: undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Email campaign created.');
      setShowForm(false);
      setFormSubject('');
      setFormFromEmail('');
      setFormTemplateId('');
      setFormBody('');
      loadEmailCampaigns(1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create email campaign.';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Send test email ────────────────────────────────────────────────────────

  const handleSendTest = async (ec: EmailCampaign) => {
    if (!testEmail.trim()) {
      showToast('error', 'Enter a test email address.');
      return;
    }
    setSendingTest(true);
    try {
      const res = await fetch(`${API_BASE}/api/communications/email-campaigns/${ec.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID, testEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', `Test email sent to ${testEmail}.`);
      setTestEmail('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send test email.';
      showToast('error', message);
    } finally {
      setSendingTest(false);
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
            <Heading as="h1" className="text-2xl font-bold text-slate-900">Email Campaigns</Heading>
            <Text variant="muted" className="mt-1">Create, send and track email campaigns</Text>
          </div>
          <Button onClick={() => { setSelectedCampaign(null); setShowForm(true); }}>+ New Email Campaign</Button>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by subject or from email…"
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
              {Object.keys(STATUS_COLORS).map((s) => (
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
            <button onClick={() => loadEmailCampaigns(page)} className="ml-3 underline font-medium">Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
                <div className="h-5 w-64 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-40 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        )}

        {/* Email campaigns table */}
        {!loading && !error && (
          emailCampaigns.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <div className="text-5xl">📧</div>
              <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">No email campaigns yet</Heading>
              <Text variant="muted" className="mt-2">Create your first email campaign to start reaching your audience.</Text>
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Subject</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">From</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Campaign</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Status</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Opens</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Clicks</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Sent At</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {emailCampaigns.map((ec) => (
                      <tr key={ec.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{ec.subject}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{ec.fromEmail}</td>
                        <td className="px-4 py-3">
                          {ec.campaign?.name ? (
                            <Badge variant="info">{ec.campaign.name}</Badge>
                          ) : (
                            <Text variant="muted" className="text-xs">—</Text>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_COLORS[ec.status] || 'neutral'}>{ec.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">{ec.openCount}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{ec.clickCount}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                          {ec.sentAt ? formatDateTime(ec.sentAt) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setSelectedCampaign(ec); setTestEmail(''); }}
                          >
                            Test
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
                    Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} email campaigns
                  </Text>
                  <div className="flex items-center gap-2">
                    <button onClick={() => loadEmailCampaigns(page - 1)} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors">
                      Previous
                    </button>
                    <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                    <button onClick={() => loadEmailCampaigns(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors">
                      Next
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )
        )}
      </div>

      {/* ─── Create Form Sheet ───────────────────────────────────────────────── */}

      <Sheet open={showForm} onClose={() => setShowForm(false)} title="New Email Campaign">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Subject *</label>
            <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="Email subject" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From Email *</label>
            <Input type="email" value={formFromEmail} onChange={(e) => setFormFromEmail(e.target.value)} placeholder="noreply@example.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Template</label>
            <select
              value={formTemplateId}
              onChange={(e) => setFormTemplateId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— No template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Body (HTML)</label>
            <textarea
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              rows={8}
              placeholder="<html>...</html>"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <Button onClick={handleCreate} disabled={saving} className="w-full">
            {saving ? 'Creating…' : 'Create Email Campaign'}
          </Button>
        </div>
      </Sheet>

      {/* ─── Test Send Sheet ──────────────────────────────────────────────────── */}

      <Sheet open={!!selectedCampaign} onClose={() => { setSelectedCampaign(null); setTestEmail(''); }} title={`Test: ${selectedCampaign?.subject}`}>
        {selectedCampaign && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Subject</Text>
                <p className="text-sm text-slate-900 mt-0.5">{selectedCampaign.subject}</p>
              </div>
              <div>
                <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">From</Text>
                <p className="text-sm text-slate-900 mt-0.5">{selectedCampaign.fromEmail}</p>
              </div>
              <div>
                <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status</Text>
                <p className="text-sm text-slate-900 mt-0.5">
                  <Badge variant={STATUS_COLORS[selectedCampaign.status] || 'neutral'}>{selectedCampaign.status}</Badge>
                </p>
              </div>
              <div>
                <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Opens / Clicks</Text>
                <p className="text-sm text-slate-900 mt-0.5">{selectedCampaign.openCount} / {selectedCampaign.clickCount}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Test Email Address</label>
              <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" />
            </div>
            <Button onClick={() => handleSendTest(selectedCampaign)} disabled={sendingTest} className="w-full">
              {sendingTest ? 'Sending…' : 'Send Test'}
            </Button>
          </div>
        )}
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

interface Template {
  id: string;
  name: string;
  type: string;
  subject?: string;
  body: string;
  variables: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
