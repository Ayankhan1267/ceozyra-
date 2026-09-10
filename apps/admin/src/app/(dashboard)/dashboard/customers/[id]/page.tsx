'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Heading, Text, Badge, Button, Card, Input, Sheet, Avatar } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  dateOfBirth: string | null;
  address: Record<string, unknown> | null;
  segment: string;
  source: string;
  health: string;
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type Activity = {
  id: string;
  type: 'note' | 'call' | 'email' | 'meeting' | 'order' | 'payment';
  title: string;
  description: string | null;
  createdAt: string;
  createdBy: string;
};

type OrderSummary = {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  currency: string;
  createdAt: string;
};

type Deal = {
  id: string;
  title: string;
  value: number;
  stage: string;
  status: string;
  createdAt: string;
};

type Tag = { id: string; name: string; color: string };

type Customer360 = {
  customer: Customer;
  activities: Activity[];
  orders: OrderSummary[];
  deals: Deal[];
};

const ACTIVITY_ICONS: Record<string, string> = {
  note: '📝',
  call: '📞',
  email: '📧',
  meeting: '📅',
  order: '📦',
  payment: '💳',
};

const ACTIVITY_COLORS: Record<string, 'success' | 'info' | 'warning' | 'neutral' | 'default'> = {
  note: 'default',
  call: 'info',
  email: 'success',
  meeting: 'warning',
  order: 'info',
  payment: 'success',
};

const SEGMENT_COLORS: Record<string, 'success' | 'warning' | 'info' | 'neutral' | 'default' | 'danger'> = {
  vip: 'success',
  premium: 'info',
  regular: 'default',
  new: 'neutral',
  at_risk: 'warning',
  churned: 'danger',
};

const HEALTH_COLORS: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'default' | 'info'> = {
  healthy: 'success',
  at_risk: 'warning',
  inactive: 'danger',
  new: 'info',
};

const STAGE_COLORS: Record<string, 'success' | 'info' | 'warning' | 'neutral' | 'default' | 'danger'> = {
  lead: 'neutral',
  qualified: 'info',
  proposal: 'warning',
  negotiation: 'warning',
  closed_won: 'success',
  closed_lost: 'danger',
};

const emptyActivityForm = { type: 'note', title: '', description: '' };

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const getFullName = (c: Customer) => `${c.firstName} ${c.lastName}`.trim() || c.email;

const getInitials = (c: Customer) => {
  const f = c.firstName?.[0] || '';
  const l = c.lastName?.[0] || '';
  return (f + l).toUpperCase() || c.email[0]?.toUpperCase() || '?';
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Customer360Page() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  // Customer data
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  // Loading & error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Activity form
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityForm, setActivityForm] = useState(emptyActivityForm);
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
    health: '',
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
      const [custRes, actRes, orderRes, dealRes, tagRes] = await Promise.all([
        fetch(`${API_BASE}/api/customers/${customerId}?tenantId=${TENANT_ID}`),
        fetch(`${API_BASE}/api/activities?tenantId=${TENANT_ID}&customerId=${customerId}`),
        fetch(`${API_BASE}/api/orders?tenantId=${TENANT_ID}&customerId=${customerId}&limit=5`),
        fetch(`${API_BASE}/api/deals?tenantId=${TENANT_ID}&customerId=${customerId}`),
        fetch(`${API_BASE}/api/tags?tenantId=${TENANT_ID}`),
      ]);

      if (!custRes.ok) {
        const data = await custRes.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${custRes.status}`);
      }
      const custData: Customer = await custRes.json();
      setCustomer(custData);

      if (actRes.ok) {
        const actData: Activity[] = await actRes.json();
        setActivities(Array.isArray(actData) ? actData : []);
      }

      if (orderRes.ok) {
        const orderData: OrderSummary[] = await orderRes.json();
        setOrders(Array.isArray(orderData) ? orderData : []);
      }

      if (dealRes.ok) {
        const dealData: Deal[] = await dealRes.json();
        setDeals(Array.isArray(dealData) ? dealData : []);
      }

      if (tagRes.ok) {
        const tagData: Tag[] = await tagRes.json();
        setAvailableTags(Array.isArray(tagData) ? tagData : []);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load customer data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (customerId) load360();
  }, [customerId, load360]);

  // ─── Open edit sheet ────────────────────────────────────────────────────────

  const openEditSheet = () => {
    if (!customer) return;
    setEditForm({
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone || '',
      segment: customer.segment,
      source: customer.source,
      health: customer.health,
    });
    setEditSheetOpen(true);
  };

  const closeEditSheet = () => {
    setEditSheetOpen(false);
  };

  const handleEditSubmit = async () => {
    if (!customer) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`${API_BASE}/api/customers/${customer.id}?tenantId=${TENANT_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          email: editForm.email,
          phone: editForm.phone || null,
          segment: editForm.segment,
          source: editForm.source,
          health: editForm.health,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const updated: Customer = await res.json();
      setCustomer(updated);
      showToast('success', 'Customer updated successfully.');
      closeEditSheet();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update customer.';
      showToast('error', message);
    } finally {
      setSavingEdit(false);
    }
  };

  // ─── Add activity ───────────────────────────────────────────────────────────

  const handleAddActivity = async () => {
    if (!activityForm.title.trim()) {
      showToast('error', 'Activity title is required.');
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
          title: activityForm.title,
          description: activityForm.description || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const newActivity: Activity = await res.json();
      setActivities((prev) => [newActivity, ...prev]);
      setActivityForm(emptyActivityForm);
      setShowActivityForm(false);
      showToast('success', 'Activity added.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add activity.';
      showToast('error', message);
    } finally {
      setSubmittingActivity(false);
    }
  };

  // ─── Segment options ────────────────────────────────────────────────────────

  const segmentOptions = [
    { value: 'new', label: 'New' },
    { value: 'regular', label: 'Regular' },
    { value: 'premium', label: 'Premium' },
    { value: 'vip', label: 'VIP' },
    { value: 'at_risk', label: 'At Risk' },
    { value: 'churned', label: 'Churned' },
  ];

  const sourceOptions = [
    { value: 'website', label: 'Website' },
    { value: 'referral', label: 'Referral' },
    { value: 'social_media', label: 'Social Media' },
    { value: 'email', label: 'Email' },
    { value: 'walk_in', label: 'Walk-in' },
    { value: 'other', label: 'Other' },
  ];

  const healthOptions = [
    { value: 'healthy', label: 'Healthy' },
    { value: 'at_risk', label: 'At Risk' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'new', label: 'New' },
  ];

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
          <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="mt-4 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-3 w-full rounded bg-slate-200" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 animate-pulse rounded-xl border border-slate-200 bg-white p-6">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 w-full rounded bg-slate-200" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !customer) {
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

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar
              src={customer.avatar || undefined}
              alt={getFullName(customer)}
              initials={getInitials(customer)}
              size="lg"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Heading as="h2" className="text-xl font-bold text-slate-900">{getFullName(customer)}</Heading>
                <Badge variant={HEALTH_COLORS[customer.health] || 'default'}>{customer.health}</Badge>
              </div>
              <Text variant="muted" className="mt-0.5">{customer.email}</Text>
              {customer.phone && <Text variant="muted" className="text-xs">{customer.phone}</Text>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={openEditSheet}>Edit</Button>
            <Button variant="outline" onClick={() => setShowActivityForm(true)}>+ Add Note</Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Total Orders</Text>
            <p className="mt-1 text-xl font-bold text-slate-900">{customer.totalOrders}</p>
          </Card>
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Total Spent</Text>
            <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(customer.totalSpent)}</p>
          </Card>
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Avg Order Value</Text>
            <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(customer.avgOrderValue)}</p>
          </Card>
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">First Order</Text>
            <p className="mt-1 text-sm font-medium text-slate-900">{formatDate(customer.firstOrderDate)}</p>
          </Card>
          <Card className="p-4">
            <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">Last Order</Text>
            <p className="mt-1 text-sm font-medium text-slate-900">{formatDate(customer.lastOrderDate)}</p>
          </Card>
        </div>

        {/* 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left sidebar: Customer info + Tags */}
          <div className="space-y-6">
            {/* Customer info card */}
            <Card className="p-5">
              <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Customer Info</Heading>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <Text variant="muted">Segment</Text>
                  <Badge variant={SEGMENT_COLORS[customer.segment] || 'default'}>{customer.segment}</Badge>
                </div>
                <div className="flex justify-between">
                  <Text variant="muted">Source</Text>
                  <span className="text-slate-700 capitalize">{customer.source?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <Text variant="muted">Health</Text>
                  <Badge variant={HEALTH_COLORS[customer.health] || 'default'}>{customer.health}</Badge>
                </div>
                {customer.dateOfBirth && (
                  <div className="flex justify-between">
                    <Text variant="muted">Date of Birth</Text>
                    <span className="text-slate-700">{formatDate(customer.dateOfBirth)}</span>
                  </div>
                )}
                {customer.address && Object.keys(customer.address).length > 0 && (
                  <div>
                    <Text variant="muted" className="text-xs font-medium uppercase tracking-wider mb-1">Address</Text>
                    <div className="text-xs text-slate-600 space-y-0.5">
                      {Object.entries(customer.address)
                        .filter(([, v]) => v != null && String(v).trim() !== '')
                        .map(([k, v]) => (
                          <div key={k}><span className="text-slate-500 capitalize">{k}: </span>{String(v)}</div>
                        ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
                  <span>Created</span>
                  <span>{formatDate(customer.createdAt)}</span>
                </div>
              </div>
            </Card>

            {/* Tags */}
            <Card className="p-5">
              <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Tags</Heading>
              {customer.tags.length === 0 ? (
                <Text variant="muted" className="text-xs">No tags assigned.</Text>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {customer.tags.map((tag, i) => (
                    <Badge key={i} variant="default">{tag}</Badge>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Center: Activity timeline */}
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Activity Timeline</Heading>
                <Button size="sm" variant="outline" onClick={() => setShowActivityForm(!showActivityForm)}>
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
                        onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as Activity['type'] })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="note">Note</option>
                        <option value="call">Call</option>
                        <option value="email">Email</option>
                        <option value="meeting">Meeting</option>
                        <option value="order">Order</option>
                        <option value="payment">Payment</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                      <Input
                        value={activityForm.title}
                        onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                        placeholder="Activity title"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                    <textarea
                      value={activityForm.description}
                      onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                      rows={2}
                      placeholder="Details…"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleAddActivity} disabled={submittingActivity}>
                      {submittingActivity ? 'Saving…' : 'Save Activity'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Activity timeline list */}
              {activities.length === 0 ? (
                <div className="text-center py-8">
                  <Text variant="muted">No activities yet. Add your first activity above.</Text>
                </div>
              ) : (
                <div className="space-y-0">
                  {activities.map((activity, index) => (
                    <div key={activity.id} className="flex gap-3">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-sm shrink-0">
                          {ACTIVITY_ICONS[activity.type] || '📌'}
                        </div>
                        {index < activities.length - 1 && (
                          <div className="w-px flex-1 bg-slate-200 min-h-[24px]" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900">{activity.title}</span>
                          <Badge variant={ACTIVITY_COLORS[activity.type] || 'default'}>{activity.type}</Badge>
                        </div>
                        {activity.description && (
                          <p className="text-xs text-slate-600 mt-0.5">{activity.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          <span>{formatDateTime(activity.createdAt)}</span>
                          {activity.createdBy && <span>by {activity.createdBy}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right: Quick actions + Recent orders + Deals */}
          <div className="space-y-6">
            {/* Quick info */}
            <Card className="p-5">
              <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Details</Heading>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <Text variant="muted">Customer ID</Text>
                  <span className="text-xs text-slate-600 font-mono">{customer.id.slice(0, 12)}…</span>
                </div>
                <div className="flex justify-between">
                  <Text variant="muted">Segment</Text>
                  <Badge variant={SEGMENT_COLORS[customer.segment] || 'default'}>{customer.segment}</Badge>
                </div>
                <div className="flex justify-between">
                  <Text variant="muted">Source</Text>
                  <span className="text-slate-700 capitalize">{customer.source?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <Text variant="muted">Health</Text>
                  <Badge variant={HEALTH_COLORS[customer.health] || 'default'}>{customer.health}</Badge>
                </div>
                <div className="flex justify-between">
                  <Text variant="muted">Total Orders</Text>
                  <span className="text-slate-700">{customer.totalOrders}</span>
                </div>
                <div className="flex justify-between">
                  <Text variant="muted">Total Spent</Text>
                  <span className="text-slate-700 font-medium">{formatCurrency(customer.totalSpent)}</span>
                </div>
              </div>
            </Card>

            {/* Recent orders */}
            <Card className="p-5">
              <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Recent Orders</Heading>
              {orders.length === 0 ? (
                <Text variant="muted" className="text-xs">No orders yet.</Text>
              ) : (
                <div className="space-y-2">
                  {orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{order.orderNumber}</p>
                        <p className="text-xs text-slate-500">{formatDate(order.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-900">{formatCurrency(order.total, order.currency)}</p>
                        <Badge variant={order.status === 'DELIVERED' || order.status === 'COMPLETED' ? 'success' : 'neutral'} className="text-[10px]">
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Deals linked */}
            <Card className="p-5">
              <Heading as="h4" className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Linked Deals</Heading>
              {deals.length === 0 ? (
                <Text variant="muted" className="text-xs">No deals linked to this customer.</Text>
              ) : (
                <div className="space-y-2">
                  {deals.slice(0, 5).map((deal) => (
                    <div key={deal.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{deal.title}</p>
                        <p className="text-xs text-slate-500">{deal.stage?.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-900">{formatCurrency(deal.value)}</p>
                        <Badge variant={STAGE_COLORS[deal.stage] || 'neutral'} className="text-[10px]">
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
      {editSheetOpen && customer && (
        <Sheet open={editSheetOpen} onClose={closeEditSheet} title="Edit Customer" side="right">
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
                {segmentOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
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
                {sourceOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Health</label>
              <select
                value={editForm.health}
                onChange={(e) => setEditForm({ ...editForm, health: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {healthOptions.map((h) => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={closeEditSheet} disabled={savingEdit}>Cancel</Button>
              <Button onClick={handleEditSubmit} disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Sheet>
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
