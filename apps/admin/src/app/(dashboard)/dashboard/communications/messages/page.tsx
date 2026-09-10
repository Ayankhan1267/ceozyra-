'use client';

import { useState, useCallback, useEffect } from 'react';
import { Heading, Text, Badge, Button, Card, Input, Sheet } from '@zyra/ui';

const API_BASE = 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP', 'LIVE_CHAT', 'SOCIAL'] as const;
const DIRECTIONS = ['INBOUND', 'OUTBOUND'] as const;
const MESSAGE_STATUSES = ['SENT', 'DELIVERED', 'READ', 'FAILED', 'QUEUED'] as const;

const CHANNEL_COLORS: Record<string, 'default' | 'success' | 'warning' | 'info' | 'neutral'> = {
  EMAIL: 'info',
  SMS: 'success',
  WHATSAPP: 'success',
  LIVE_CHAT: 'info',
  SOCIAL: 'warning',
};

const STATUS_COLORS: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  SENT: 'info',
  DELIVERED: 'success',
  READ: 'success',
  FAILED: 'danger',
  QUEUED: 'warning',
};

type MessageItem = {
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

type PaginatedMessages = {
  messages: MessageItem[];
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

const truncate = (text: string, max = 80) => (text.length > max ? text.slice(0, max) + '…' : text);

// ─── Component ─────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);

  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [convFilter, setConvFilter] = useState('');

  // Message detail
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Load messages ──────────────────────────────────────────────────────────

  const loadMessages = useCallback(async (pageNum = 1) => {
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
      if (directionFilter !== 'all') params.set('direction', directionFilter);
      if (convFilter.trim()) params.set('conversationId', convFilter.trim());

      const res = await fetch(`${API_BASE}/api/communications/messages?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: PaginatedMessages = await res.json();
      setMessages(data.messages || []);
      setPage(data.page || pageNum);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load messages.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [channelFilter, statusFilter, directionFilter, convFilter, limit]);

  useEffect(() => {
    loadMessages(1);
  }, [loadMessages]);

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
        <div>
          <Heading as="h1" className="text-2xl font-bold text-slate-900">Messages</Heading>
          <Text variant="muted" className="mt-1">Global message log across all conversations</Text>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  value={convFilter}
                  onChange={(e) => { setConvFilter(e.target.value); setPage(1); }}
                  placeholder="Filter by conversation ID…"
                  className="w-full"
                />
              </div>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
                {DIRECTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setDirectionFilter(d); setPage(1); }}
                    className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                      directionFilter === d ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
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
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => { setStatusFilter('all'); setPage(1); }}
                  className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All Status
                </button>
                {MESSAGE_STATUSES.map((s) => (
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
          </div>
        </Card>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => loadMessages(page)} className="ml-3 underline font-medium">Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
                <div className="h-4 w-64 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-40 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        )}

        {/* Messages table */}
        {!loading && !error && (
          messages.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <div className="text-5xl">✉️</div>
              <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">No messages found</Heading>
              <Text variant="muted" className="mt-2">Messages will appear here as conversations happen.</Text>
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">From / To</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Body</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Direction</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Channel</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Sent At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {messages.map((msg) => (
                      <tr
                        key={msg.id}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedMessage(msg)}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-slate-900 text-xs">{msg.from || msg.to || '—'}</p>
                            <p className="text-xs text-slate-500 mt-0.5">→ {msg.to || msg.from || '—'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs max-w-xs">
                          <span className="line-clamp-2">{truncate(msg.body, 90)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_COLORS[msg.status] || 'neutral'}>{msg.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={msg.direction === 'INBOUND' ? 'info' : 'default'}>{msg.direction}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={CHANNEL_COLORS[msg.channel] || 'default'}>{msg.channel}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                          {formatDateTime(msg.sentAt)}
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
                    Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} messages
                  </Text>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadMessages(page - 1)}
                      disabled={page <= 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => loadMessages(page + 1)}
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

      {/* ─── Message Detail Sheet ─────────────────────────────────────────────── */}

      <Sheet open={!!selectedMessage} onClose={() => setSelectedMessage(null)} title="Message Detail">
        {selectedMessage && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">From</Text>
                <p className="text-sm text-slate-900 mt-0.5">{selectedMessage.from || '—'}</p>
              </div>
              <div>
                <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">To</Text>
                <p className="text-sm text-slate-900 mt-0.5">{selectedMessage.to || '—'}</p>
              </div>
              <div>
                <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Channel</Text>
                <p className="text-sm text-slate-900 mt-0.5">
                  <Badge variant={CHANNEL_COLORS[selectedMessage.channel] || 'default'}>{selectedMessage.channel}</Badge>
                </p>
              </div>
              <div>
                <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Direction</Text>
                <p className="text-sm text-slate-900 mt-0.5">
                  <Badge variant={selectedMessage.direction === 'INBOUND' ? 'info' : 'default'}>{selectedMessage.direction}</Badge>
                </p>
              </div>
              <div>
                <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status</Text>
                <p className="text-sm text-slate-900 mt-0.5">
                  <Badge variant={STATUS_COLORS[selectedMessage.status] || 'neutral'}>{selectedMessage.status}</Badge>
                </p>
              </div>
              <div>
                <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sent At</Text>
                <p className="text-sm text-slate-900 mt-0.5">{formatDateTime(selectedMessage.sentAt)}</p>
              </div>
            </div>
            <div>
              <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Body</Text>
              <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedMessage.body}</p>
              </div>
            </div>
            <div>
              <Text className="text-xs font-medium text-slate-500 uppercase tracking-wider">Conversation ID</Text>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">{selectedMessage.conversationId}</p>
            </div>
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
