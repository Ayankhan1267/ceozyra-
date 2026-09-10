'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Heading,
  Text,
  Badge,
  Button,
  Card,
  Input,
  Label,
  Textarea,
  Tabs,
  TabPanel,
  Select,
  Switch,
  Avatar,
  Alert,
  Separator,
} from '@zyra/ui';

// ─── Constants ──────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Types ──────────────────────────────────────────────────────────────────────

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  segment: string;
  source: string;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type Customer360View = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  segment: string;
  source: string;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  orders: OrderSummary[];
  deals: DealSummary[];
  stats: {
    totalOrders: number;
    totalSpent: number;
    avgOrderValue: number;
    lifetimeValue: number;
    segment: string;
    purchaseFrequency: { ordersPerMonth: number; avgDaysBetweenOrders: number | null };
    customerSegments: CustomerSegmentRef[];
    recentActivity: ActivitySummary[];
  };
};

type OrderSummary = {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  currency: string;
  createdAt: string;
  items?: { name: string; quantity: number; total: number }[];
};

type DealSummary = {
  id: string;
  title: string;
  value: number;
  currency: string;
  status: string;
  stageId: string;
  pipeline: { id: string; name: string } | null;
  createdAt: string;
};

type ActivitySummary = {
  id: string;
  type: string;
  subject: string;
  description?: string;
  createdAt: string;
};

type CustomerSegmentRef = { id: string; name: string; description?: string };

type ConsentRecord = { type: string; granted: boolean; timestamp: string; source: string };

type CustomerPreferences = {
  notificationChannels: { email: boolean; sms: boolean; whatsapp: boolean; push: boolean };
  marketingOptIn: boolean;
  dataProcessingConsent: boolean;
  language: string;
  timezone: string;
  updatedAt: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const getFullName = (c: Customer) => `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email;

const getInitials = (c: Customer) => {
  const f = c.firstName?.[0] || '';
  const l = c.lastName?.[0] || '';
  return (f + l).toUpperCase() || c.email[0]?.toUpperCase() || '?';
};

const ACTIVITY_ICONS: Record<string, string> = {
  note: '📝',
  call: '📞',
  email: '📧',
  meeting: '📅',
  task: '✅',
  sms: '💬',
  whatsapp: '📲',
  other: '📌',
};

const ACTIVITY_COLORS: Record<string, 'success' | 'info' | 'warning' | 'neutral' | 'default'> = {
  note: 'default',
  call: 'info',
  email: 'success',
  meeting: 'warning',
  task: 'info',
  sms: 'neutral',
  whatsapp: 'info',
  other: 'neutral',
};

const SEGMENT_COLORS: Record<string, 'success' | 'warning' | 'info' | 'neutral' | 'default' | 'danger'> = {
  vip: 'success',
  premium: 'info',
  regular: 'default',
  new: 'neutral',
  at_risk: 'warning',
  churned: 'danger',
};

const DEAL_STATUS_COLORS: Record<string, 'success' | 'warning' | 'neutral' | 'danger' | 'info'> = {
  OPEN: 'info',
  WON: 'success',
  LOST: 'danger',
  CANCELLED: 'neutral',
};

const CONSENT_TYPE_LABELS: Record<string, string> = {
  email: 'Email Communications',
  sms: 'SMS Messages',
  whatsapp: 'WhatsApp Messages',
  data_processing: 'Data Processing',
  marketing: 'Marketing & Promotions',
  cookies: 'Cookies & Tracking',
};

const CHANNEL_ICONS: Record<string, string> = {
  email: '📧',
  sms: '💬',
  whatsapp: '📲',
  push: '🔔',
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  // 360 view data
  const [view, setView] = useState<Customer360View | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preferences & consent
  const [preferences, setPreferences] = useState<CustomerPreferences | null>(null);
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([]);
  const [loadingConsent, setLoadingConsent] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Activity form
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'note', subject: '', description: '' });
  const [submittingActivity, setSubmittingActivity] = useState(false);

  // Edit sheet
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    segment: '',
    source: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Load 360 data ──────────────────────────────────────────────────────────

  const load360 = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/customers/${customerId}/360?tenantId=${TENANT_ID}`, { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: Customer360View = await res.json();
      setView(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load customer data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  // ─── Load preferences & consent ─────────────────────────────────────────────

  const loadConsent = useCallback(async () => {
    setLoadingConsent(true);
    try {
      const [prefsRes, consentRes] = await Promise.all([
        fetch(`${API_BASE}/api/customers/${customerId}/preferences?tenantId=${TENANT_ID}`, { cache: 'no-store' }),
        fetch(`${API_BASE}/api/customers/${customerId}/consent?tenantId=${TENANT_ID}`, { cache: 'no-store' }),
      ]);
      if (prefsRes.ok) setPreferences(await prefsRes.json());
      if (consentRes.ok) setConsentRecords(await consentRes.json());
    } catch { /* silently ignore — preferences are optional */ } finally {
      setLoadingConsent(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (customerId) load360();
  }, [customerId, load360]);

  useEffect(() => {
    if (view?.id) loadConsent();
  }, [view?.id, loadConsent]);

  // ─── Update preferences ─────────────────────────────────────────────────────

  const handleToggleChannel = async (channel: keyof CustomerPreferences['notificationChannels']) => {
    if (!preferences) return;
    const updatedChannels = { ...preferences.notificationChannels, [channel]: !preferences.notificationChannels[channel] };
    setSavingPrefs(true);
    try {
      const res = await fetch(`${API_BASE}/api/customers/${customerId}/preferences?tenantId=${TENANT_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationChannels: updatedChannels }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated: CustomerPreferences = await res.json();
      setPreferences(updated);
      showToast('success', 'Notification preference updated.');
    } catch {
      showToast('error', 'Failed to update preference.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleRecordConsent = async (type: string, granted: boolean) => {
    setLoadingConsent(true);
    try {
      const res = await fetch(`${API_BASE}/api/customers/${customerId}/consent?tenantId=${TENANT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, granted, source: 'admin_panel' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const record: ConsentRecord = await res.json();
      setConsentRecords((prev) => [record, ...prev.filter((c) => c.type !== type)]);
      showToast('success', `Consent ${granted ? 'granted' : 'revoked'} for ${CONSENT_TYPE_LABELS[type] || type}.`);
    } catch {
      showToast('error', 'Failed to record consent.');
    } finally {
      setLoadingConsent(false);
    }
  };

  // ─── Add activity ───────────────────────────────────────────────────────────

  const handleAddActivity = async () => {
    if (!activityForm.subject.trim()) {
      showToast('error', 'Activity subject is required.');
      return;
    }
    setSubmittingActivity(true);
    try {
      const res = await fetch(`${API_BASE}/api/activities?tenantId=${TENANT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          type: activityForm.type,
          subject: activityForm.subject,
          description: activityForm.description || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const newActivity: ActivitySummary = await res.json();
      setView((prev) =>
        prev
          ? {
              ...prev,
              stats: {
                ...prev.stats,
                recentActivity: [newActivity, ...prev.stats.recentActivity],
              },
            }
          : prev,
      );
      setActivityForm({ type: 'note', subject: '', description: '' });
      setShowActivityForm(false);
      showToast('success', 'Activity added.');
    } catch {
      showToast('error', 'Failed to add activity.');
    } finally {
      setSubmittingActivity(false);
    }
  };

  // ─── Navigation helpers ─────────────────────────────────────────────────────

  const navigateToOrder = (id: string) => router.push(`/dashboard/orders?highlight=${id}`);
  const navigateToDeal = (id: string) => router.push(`/dashboard/pipeline?deal=${id}`);

  // ─── Open edit sheet ────────────────────────────────────────────────────────

  const openEditSheet = () => {
    if (!view) return;
    setEditForm({
      firstName: view.firstName,
      lastName: view.lastName,
      email: view.email,
      phone: view.phone || '',
      segment: view.segment,
      source: view.source,
    });
    setEditSheetOpen(true);
  };

  const closeEditSheet = () => setEditSheetOpen(false);

  const handleEditSubmit = async () => {
    if (!view) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`${API_BASE}/api/customers/${view.id}?tenantId=${TENANT_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          email: editForm.email,
          phone: editForm.phone || null,
          segment: editForm.segment,
          source: editForm.source,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated: Customer = await res.json();
      setView((prev) => (prev ? { ...prev, ...updated } : prev));
      showToast('success', 'Customer updated.');
      closeEditSheet();
    } catch {
      showToast('error', 'Failed to update customer.');
    } finally {
      setSavingEdit(false);
    }
  };

  // ─── SVG Icons ──────────────────────────────────────────────────────────────

  const IconMail = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );

  const IconMessage = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-3.91 8.281-8.745 8.745-.398 0-.787-.028-1.17-.082a.75.75 0 01-.606-.603l-.074-.38a48.153 48.153 0 00-1.162-1.354A48.495 48.495 0 003 12c0-4.556 3.91-8.281 8.745-8.745.398 0 .787.028 1.17.082a.75.75 0 01.606.603l.074.38a48.153 48.153 0 001.162 1.354A48.495 48.495 0 0021 12z" />
    </svg>
  );

  const IconDeal = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );

  const IconFileExport = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );

  // ─── Loading / Error states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-64 rounded bg-slate-200" />
          <div className="mt-4 h-4 w-48 rounded bg-slate-200" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="mt-2 h-8 w-16 rounded bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
          <div className="lg:col-span-2 animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
        </div>
      </div>
    );
  }

  if (error || !view) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl">⚠️</div>
        <Heading as="h3" className="mt-4 text-lg font-semibold text-slate-900">Customer not found</Heading>
        <Text variant="muted" className="mt-2">{error || 'This customer may have been deleted.'}</Text>
        <Button variant="outline" onClick={() => router.push('/dashboard/customers')} className="mt-4">
          Back to Customers
        </Button>
      </div>
    );
  }

  const { stats } = view;

  return (
    <>
      <div className="space-y-6">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar
              src={view.avatar || undefined}
              alt={getFullName(view)}
              initials={getInitials(view)}
              size="lg"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Heading as="h2" className="text-xl font-bold text-slate-900">{getFullName(view)}</Heading>
                <Badge variant={SEGMENT_COLORS[view.segment] || 'default'}>{view.segment || 'new'}</Badge>
              </div>
              <Text variant="muted" className="mt-0.5">{view.email}</Text>
              {view.phone && <Text variant="muted" className="text-xs">{view.phone}</Text>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={openEditSheet}>Edit</Button>
            <Button variant="outline" onClick={() => setShowActivityForm((o) => !o)}>+ Note</Button>
            <Button variant="outline" onClick={() => router.push(`/dashboard/pipeline?newDeal=${view.id}`)}>+ Deal</Button>
          </div>
        </div>

        {/* ── Stats row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Total Orders</Text>
            <p className="mt-1 text-xl font-bold text-slate-900">{stats.totalOrders}</p>
          </Card>
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Lifetime Value</Text>
            <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(stats.lifetimeValue)}</p>
          </Card>
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Avg Order</Text>
            <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(stats.avgOrderValue)}</p>
          </Card>
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Orders / Month</Text>
            <p className="mt-1 text-xl font-bold text-slate-900">{stats.purchaseFrequency.ordersPerMonth}</p>
          </Card>
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Avg Gap</Text>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {stats.purchaseFrequency.avgDaysBetweenOrders !== null
                ? `${stats.purchaseFrequency.avgDaysBetweenOrders}d`
                : '—'}
            </p>
          </Card>
        </div>

        {/* ── 3-column layout ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Customer info + Segments + Tags */}
          <div className="space-y-6">
            {/* Customer info card */}
            <Card className="p-5">
              <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
                Customer Info
              </Heading>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <Text variant="muted">Email</Text>
                  <span className="text-slate-700 text-xs">{view.email}</span>
                </div>
                <div className="flex justify-between">
                  <Text variant="muted">Phone</Text>
                  <span className="text-slate-700">{view.phone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <Text variant="muted">Segment</Text>
                  <Badge variant={SEGMENT_COLORS[view.segment] || 'default'}>{view.segment || 'new'}</Badge>
                </div>
                <div className="flex justify-between">
                  <Text variant="muted">Source</Text>
                  <span className="text-slate-700 capitalize">{view.source?.replace(/_/g, ' ') || '—'}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Member since</span>
                  <span>{formatDate(view.createdAt)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Last updated</span>
                  <span>{formatDate(view.updatedAt)}</span>
                </div>
              </div>
            </Card>

            {/* Customer Segments */}
            <Card className="p-5">
              <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
                Customer Segments
              </Heading>
              {stats.customerSegments.length === 0 ? (
                <Text variant="muted" className="text-xs">Not in any dynamic segment.</Text>
              ) : (
                <div className="space-y-2">
                  {stats.customerSegments.map((seg) => (
                    <div key={seg.id} className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                      <p className="text-sm font-medium text-slate-900">{seg.name}</p>
                      {seg.description && <p className="text-xs text-slate-500 mt-0.5">{seg.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Tags */}
            <Card className="p-5">
              <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Tags</Heading>
              {view.tags.length === 0 ? (
                <Text variant="muted" className="text-xs">No tags assigned.</Text>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {view.tags.map((tag, i) => (
                    <Badge key={i} variant="default">{tag}</Badge>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Center: Activity Timeline + Consent */}
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  Activity Timeline
                </Heading>
                <Button size="sm" variant="outline" onClick={() => setShowActivityForm((o) => !o)}>
                  {showActivityForm ? 'Cancel' : '+ Add Activity'}
                </Button>
              </div>

              {/* Add activity form */}
              {showActivityForm && (
                <div className="mb-4 p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                      <select
                        value={activityForm.type}
                        onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="note">Note</option>
                        <option value="call">Call</option>
                        <option value="email">Email</option>
                        <option value="meeting">Meeting</option>
                        <option value="task">Task</option>
                        <option value="sms">SMS</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Subject *</label>
                      <Input
                        value={activityForm.subject}
                        onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
                        placeholder="Activity subject"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                    <Textarea
                      value={activityForm.description}
                      onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                      rows={2}
                      placeholder="Details…"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleAddActivity} disabled={submittingActivity}>
                      {submittingActivity ? 'Saving…' : 'Save Activity'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Activity timeline */}
              {stats.recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <Text variant="muted">No activities yet. Add your first above.</Text>
                </div>
              ) : (
                <div className="space-y-0">
                  {stats.recentActivity.map((activity, index) => (
                    <div key={activity.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-sm shrink-0">
                          {ACTIVITY_ICONS[activity.type] || '📌'}
                        </div>
                        {index < stats.recentActivity.length - 1 && (
                          <div className="w-px flex-1 bg-slate-200 min-h-[24px]" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900">{activity.subject}</span>
                          <Badge variant={ACTIVITY_COLORS[activity.type] || 'default'}>
                            {activity.type}
                          </Badge>
                        </div>
                        {activity.description && (
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{activity.description}</p>
                        )}
                        <span className="text-xs text-slate-400 mt-1 block">{formatDateTime(activity.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Consent & Preferences tabs */}
            <Card className="p-5">
              <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
                Consent & Preferences
              </Heading>
              <Tabs
                defaultValue="consent"
                tabs={[
                  { value: 'consent', label: 'Consent' },
                  { value: 'preferences', label: 'Preferences' },
                ]}
              >
                {(activeTab) => (
                  <>
                    <TabPanel value="consent" activeTab={activeTab}>
                      {loadingConsent ? (
                        <Text variant="muted" className="text-xs">Loading consent…</Text>
                      ) : (
                        <div className="space-y-3">
                          {consentRecords.map((record) => (
                            <div
                              key={record.type}
                              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-900">
                                  {CONSENT_TYPE_LABELS[record.type] || record.type}
                                </span>
                                <Badge variant={record.granted ? 'success' : 'danger'} className="text-[10px]">
                                  {record.granted ? 'Granted' : 'Revoked'}
                                </Badge>
                              </div>
                              <Button
                                size="sm"
                                variant={record.granted ? 'outline' : 'default'}
                                onClick={() => handleRecordConsent(record.type, !record.granted)}
                                disabled={loadingConsent}
                              >
                                {record.granted ? 'Revoke' : 'Grant'}
                              </Button>
                            </div>
                          ))}
                          {consentRecords.length === 0 && (
                            <Text variant="muted" className="text-xs">No consent records.</Text>
                          )}
                          <div className="pt-2">
                            <Text variant="small" className="text-slate-400">
                              Last updated: {preferences ? formatDateTime(preferences.updatedAt) : '—'}
                            </Text>
                          </div>
                        </div>
                      )}
                    </TabPanel>

                    <TabPanel value="preferences" activeTab={activeTab}>
                      {!preferences ? (
                        <Text variant="muted" className="text-xs">No preferences set yet.</Text>
                      ) : (
                        <div className="space-y-3">
                          {Object.entries(preferences.notificationChannels).map(([channel, enabled]) => (
                            <div
                              key={channel}
                              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5"
                            >
                              <div className="flex items-center gap-2">
                                <span>{CHANNEL_ICONS[channel]}</span>
                                <span className="text-sm font-medium text-slate-900 capitalize">{channel}</span>
                              </div>
                              <Switch
                                checked={enabled}
                                onChange={() => handleToggleChannel(channel as keyof CustomerPreferences['notificationChannels'])}
                                disabled={savingPrefs}
                              />
                            </div>
                          ))}
                          <Separator className="my-3" />
                          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                            <span className="text-sm font-medium text-slate-900">Marketing Opt-in</span>
                            <Switch
                              checked={preferences.marketingOptIn}
                              onChange={async () => {
                                const updated = !preferences.marketingOptIn;
                                await handleRecordConsent('marketing', updated);
                                if (preferences) {
                                  setPreferences({ ...preferences, marketingOptIn: updated });
                                }
                              }}
                              disabled={savingPrefs || loadingConsent}
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                            <span className="text-sm font-medium text-slate-900">Data Processing</span>
                            <Switch
                              checked={preferences.dataProcessingConsent}
                              onChange={async () => {
                                const updated = !preferences.dataProcessingConsent;
                                await handleRecordConsent('data_processing', updated);
                                if (preferences) {
                                  setPreferences({ ...preferences, dataProcessingConsent: updated });
                                }
                              }}
                              disabled={savingPrefs || loadingConsent}
                            />
                          </div>
                        </div>
                      )}
                    </TabPanel>
                  </>
                )}
              </Tabs>
            </Card>
          </div>

          {/* Right: Orders + Deals + Quick Actions */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="p-5">
              <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
                Quick Actions
              </Heading>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="justify-start" onClick={() => router.push(`/dashboard/orders?newOrderCustomer=${view.id}`)}>
                  + New Order
                </Button>
                <Button variant="outline" size="sm" className="justify-start" onClick={() => router.push(`/dashboard/pipeline?newDeal=${view.id}`)}>
                  + New Deal
                </Button>
                <Button variant="outline" size="sm" className="justify-start" onClick={() => router.push(`/dashboard/communications/campaigns?recipient=${view.email}`)}>
                  <span className="flex items-center gap-2"><IconMail /> Send Email</span>
                </Button>
                <Button variant="outline" size="sm" className="justify-start" onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE}/api/customers/${customerId}/export?tenantId=${TENANT_ID}`);
                    if (res.ok) {
                      const data = await res.json();
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `customer-${customerId}-export.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      showToast('success', 'Customer data exported.');
                    }
                  } catch { showToast('error', 'Export failed.'); }
                }}>
                  <span className="flex items-center gap-2"><IconFileExport /> Export</span>
                </Button>
              </div>
            </Card>

            {/* Recent Orders */}
            <Card className="p-5">
              <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
                Recent Orders ({stats.totalOrders})
              </Heading>
              {view.orders.length === 0 ? (
                <Text variant="muted" className="text-xs">No orders yet.</Text>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto">
                  {view.orders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => navigateToOrder(order.id)}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{order.orderNumber}</p>
                        <p className="text-xs text-slate-500">{formatDate(order.createdAt)}</p>
                        {order.items && order.items.length > 0 && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {order.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-sm font-medium text-slate-900">{formatCurrency(order.total, order.currency)}</p>
                        <Badge
                          variant={
                            order.status === 'DELIVERED' || order.status === 'COMPLETED'
                              ? 'success'
                              : order.status === 'CANCELLED' || order.status === 'REFUNDED'
                                ? 'danger'
                                : 'neutral'
                          }
                          className="text-[10px]"
                        >
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Linked Deals */}
            <Card className="p-5">
              <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
                Linked Deals ({view.deals.length})
              </Heading>
              {view.deals.length === 0 ? (
                <Text variant="muted" className="text-xs">No deals linked to this customer.</Text>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {view.deals.map((deal) => (
                    <div
                      key={deal.id}
                      onClick={() => navigateToDeal(deal.id)}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{deal.title}</p>
                        {deal.pipeline && (
                          <p className="text-xs text-slate-500">{deal.pipeline.name} · Stage {deal.stageId}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-sm font-medium text-slate-900">{formatCurrency(Number(deal.value), deal.currency)}</p>
                        <Badge variant={DEAL_STATUS_COLORS[deal.status] || 'neutral'} className="text-[10px]">
                          {deal.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* ─── Edit Customer Sheet ─────────────────────────────────────────────── */}
      {editSheetOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div className="flex-1 bg-black/40" onClick={closeEditSheet} />

          {/* Sheet */}
          <div className="w-full max-w-md bg-white shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-right">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <Heading as="h3" className="text-lg font-semibold">Edit Customer</Heading>
              <button onClick={closeEditSheet} className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" aria-label="Close">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                  <Input
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                  <Input
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Segment</label>
                  <select
                    value={editForm.segment}
                    onChange={(e) => setEditForm({ ...editForm, segment: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {['new', 'regular', 'premium', 'vip', 'at_risk', 'churned'].map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
                  <select
                    value={editForm.source}
                    onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {['website', 'referral', 'social_media', 'email', 'walk_in', 'other'].map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <Button variant="outline" onClick={closeEditSheet} disabled={savingEdit}>Cancel</Button>
              <Button onClick={handleEditSubmit} disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Toast ───────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={[
            'fixed top-6 right-6 z-[60] rounded-lg px-5 py-3 shadow-lg text-sm font-medium transition-all',
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white',
          ].join(' ')}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
