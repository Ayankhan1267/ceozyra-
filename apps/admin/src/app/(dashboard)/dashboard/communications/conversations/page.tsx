'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Heading, Text, Badge, Button, Card, Input, Sheet } from '@zyra/ui';

const API_BASE = 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP', 'LIVE_CHAT', 'SOCIAL'] as const;
const STATUSES = ['OPEN', 'CLOSED', 'PENDING'] as const;

const CHANNEL_COLORS: Record<string, 'default' | 'success' | 'warning' | 'info' | 'neutral'> = {
  EMAIL: 'info',
  SMS: 'success',
  WHATSAPP: 'success',
  LIVE_CHAT: 'info',
  SOCIAL: 'warning',
};

const STATUS_COLORS: Record<string, 'success' | 'danger' | 'warning' | 'neutral' | 'info' | 'default'> = {
  OPEN: 'info',
  CLOSED: 'success',
  PENDING: 'warning',
};

type Conversation = {
  id: string;
  customerId: string;
  customerEmail: string;
  customerName?: string;
  channel: string;
  status: string;
  lastMessageAt: string;
  messageCount: number;
  subject?: string;
};

type Message = {
  id: string;
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  from?: string;
  to?: string;
  body: string;
  status: string;
  channel: string;
  sentAt: string;
};

type PaginatedConversations = {
  conversations: Conversation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);

  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Detail sheet
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // New conversation sheet
  const [showNewConv, setShowNewConv] = useState(false);
  const [newConvEmail, setNewConvEmail] = useState('');
  const [newConvChannel, setNewConvChannel] = useState('EMAIL');

  // Mutations
  const [updating, setUpdating] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Load conversations ──────────────────────────────────────────────────────

  const loadConversations = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tenantId: TENANT_ID,
        page: String(pageNum),
        limit: String(limit),
      });
      if (channelFilter !== 'all') params.set('channel', channelFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`${API_BASE}/api/communications/conversations?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: PaginatedConversations = await res.json();
      setConversations(data.conversations || []);
      setPage(data.page || pageNum);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load conversations.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [channelFilter, statusFilter, limit]);

  useEffect(() => {
    loadConversations(1);
  }, [loadConversations]);

  // ─── Search ─────────────────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) {
      loadConversations(1);
      return;
    }
    searchTimer.current = setTimeout(() => doSearch(value), 400);
  };

  const doSearch = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenantId: TENANT_ID, limit: '50' });
      if (channelFilter !== 'all') params.set('channel', channelFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`${API_BASE}/api/communications/conversations?${params}`);
      const data: PaginatedConversations = await res.json();
      const q = query.toLowerCase();
      const filtered = (data.conversations || []).filter((c) => {
        const nameMatch = (c.customerName || '').toLowerCase().includes(q);
        const emailMatch = (c.customerEmail || '').toLowerCase().includes(q);
        const subjectMatch = (c.subject || '').toLowerCase().includes(q);
        return nameMatch || emailMatch || subjectMatch;
      });
      setConversations(filtered);
      setTotalPages(1);
      setTotal(filtered.length);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // ─── Open conversation detail ────────────────────────────────────────────────

  const openDetail = async (conv: Conversation) => {
    setSelectedConversation(conv);
    setLoadingMessages(true);
    setMessages([]);
    try {
      const res = await fetch(`${API_BASE}/api/communications/conversations/${conv.id}/messages?tenantId=${TENANT_ID}`);
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      showToast('error', 'Failed to load messages.');
    } finally {
      setLoadingMessages(false);
    }
  };

  // ─── Close conversation ──────────────────────────────────────────────────────

  const handleCloseConversation = async () => {
    if (!selectedConversation) return;
    setUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/api/communications/conversations/${selectedConversation.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      setSelectedConversation((prev) => (prev ? { ...prev, status: 'CLOSED' } : null));
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedConversation.id ? { ...c, status: 'CLOSED' } : c)),
      );
      showToast('success', 'Conversation closed.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to close conversation.';
      showToast('error', message);
    } finally {
      setUpdating(false);
    }
  };

  // ─── Create conversation ─────────────────────────────────────────────────────

  const handleCreateConversation = async () => {
    if (!newConvEmail.trim()) {
      showToast('error', 'Customer email is required.');
      return;
    }
    setUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/api/communications/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: TENANT_ID,
          customerEmail: newConvEmail,
          channel: newConvChannel,
          subject: 'New conversation',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Conversation created.');
      setShowNewConv(false);
      setNewConvEmail('');
      setNewConvChannel('EMAIL');
      loadConversations(1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create conversation.';
      showToast('error', message);
    } finally {
      setUpdating(false);
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
            <Heading as="h1" className="text-2xl font-bold text-slate-900">Conversations</Heading>
            <Text variant="muted" className="mt-1">Manage customer conversations across channels</Text>
          </div>
          <Button onClick={() => setShowNewConv(true)}>+ New Conversation</Button>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search by name, email, or subject…"
                  className="w-full"
                />
              </div>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
                <button
                  onClick={() => { setChannelFilter('all'); setPage(1); }}
                  className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    channelFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All Channels
                </button>
                {CHANNELS.map((ch) => (
                  <button
                    key={ch}
                    onClick={() => { setChannelFilter(ch); setPage(1); }}
                    className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                      channelFilter === ch ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
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
            <button onClick={() => loadConversations(page)} className="ml-3 underline font-medium">Retry</button>
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

        {/* Conversations table */}
        {!loading && !error && (
          conversations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <div className="text-5xl">💬</div>
              <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">No conversations found</Heading>
              <Text variant="muted" className="mt-2">Conversations will appear here when customers reach out.</Text>
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Customer</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Channel</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Last Message</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Messages</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {conversations.map((conv) => (
                      <tr key={conv.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-slate-900">{conv.customerName || conv.customerEmail}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{conv.customerEmail}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={CHANNEL_COLORS[conv.channel] || 'default'}>{conv.channel}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_COLORS[conv.status] || 'neutral'}>{conv.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {conv.lastMessageAt ? formatDateTime(conv.lastMessageAt) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{conv.messageCount}</td>
                        <td className="px-4 py-3 text-center">
                          <Button size="sm" variant="outline" onClick={() => openDetail(conv)}>
                            View
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
                    Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} conversations
                  </Text>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadConversations(page - 1)}
                      disabled={page <= 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => loadConversations(page + 1)}
                      disabled={page >= totalPages}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )
        )}
      </div>

      {/* ─── Conversation Detail Sheet ───────────────────────────────────────── */}

      <Sheet open={!!selectedConversation} onClose={() => { setSelectedConversation(null); setMessages([]); }} title="Conversation Messages">
        {selectedConversation && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-slate-900">{selectedConversation.customerName || selectedConversation.customerEmail}</p>
                <p className="text-xs text-slate-500">{selectedConversation.customerEmail}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={CHANNEL_COLORS[selectedConversation.channel] || 'default'}>{selectedConversation.channel}</Badge>
                <Badge variant={STATUS_COLORS[selectedConversation.status] || 'neutral'}>{selectedConversation.status}</Badge>
              </div>
            </div>

            {selectedConversation.status === 'OPEN' && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={handleCloseConversation}
                disabled={updating}
              >
                {updating ? 'Closing…' : 'Close Conversation'}
              </Button>
            )}

            {loadingMessages ? (
              <Text variant="muted" className="text-center block py-8">Loading messages…</Text>
            ) : messages.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <Text variant="muted">No messages in this conversation yet.</Text>
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg p-3 text-sm ${
                      msg.direction === 'INBOUND'
                        ? 'bg-slate-100 text-slate-900 ml-0'
                        : 'bg-indigo-50 text-indigo-900 ml-8'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-xs">{msg.direction === 'INBOUND' ? (msg.from || 'Customer') : 'You'}</span>
                      <Badge variant={msg.direction === 'INBOUND' ? 'neutral' : 'info'}>{msg.direction}</Badge>
                      <span className="text-xs text-slate-400">{formatDateTime(msg.sentAt)}</span>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{msg.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Sheet>

      {/* ─── New Conversation Sheet ───────────────────────────────────────────── */}

      <Sheet open={showNewConv} onClose={() => setShowNewConv(false)} title="New Conversation">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Customer Email *</label>
            <Input
              value={newConvEmail}
              onChange={(e) => setNewConvEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Channel</label>
            <select
              value={newConvChannel}
              onChange={(e) => setNewConvChannel(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CHANNELS.map((ch) => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </div>
          <Button onClick={handleCreateConversation} disabled={updating} className="w-full">
            {updating ? 'Creating…' : 'Create Conversation'}
          </Button>
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
