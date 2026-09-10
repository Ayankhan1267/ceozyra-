'use client';

import { useState, useEffect } from 'react';
import { Heading, Text, Button, Input, Badge, Sheet, Card, CardHeader, CardTitle, CardContent, Select, Label } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

interface Discount {
  id: string;
  name: string;
  code: string | null;
  type: string;
  value: number;
  minOrderAmount: number;
  maxUses: number | null;
  usedCount: number;
  startDate: string | null;
  endDate: string | null;
  appliesTo: string;
  isActive: boolean;
  createdAt: string;
  usageCount: number;
}

interface Stats {
  usageCount: number;
  totalRevenueImpact: number;
  averageOrderValue: number;
  recentUsages: Array<{
    customer: { email: string; firstName: string; lastName: string } | null;
    orderId: string;
    orderTotal: number | null;
    usedAt: string;
  }>;
  usageByDay: Array<{ date: string; count: number }>;
}

const DISCOUNT_TYPES = [
  { value: 'PERCENTAGE', label: 'Percentage (%)' },
  { value: 'FIXED_AMOUNT', label: 'Fixed Amount ($)' },
  { value: 'FREE_SHIPPING', label: 'Free Shipping' },
];

const APPLIES_TO_OPTIONS = [
  { value: 'ALL', label: 'All Items' },
  { value: 'CATEGORY', label: 'Specific Categories' },
  { value: 'PRODUCT', label: 'Specific Products' },
  { value: 'COLLECTION', label: 'Specific Collections' },
];

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [statsDiscount, setStatsDiscount] = useState<Discount | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState('PERCENTAGE');
  const [formValue, setFormValue] = useState('');
  const [formMinOrder, setFormMinOrder] = useState('0');
  const [formMaxUses, setFormMaxUses] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formAppliesTo, setFormAppliesTo] = useState('ALL');
  const [formActive, setFormActive] = useState(true);

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tenantId: TENANT_ID });
      if (search) params.set('search', search);
      if (filterActive) params.set('isActive', filterActive);
      const res = await fetch(`${API_BASE}/discounts?${params}`, { cache: 'no-store' });
      const data = await res.json();
      setDiscounts(data.discounts || []);
    } finally {
      setLoading(false);
    }
  };

  const openSheet = (discount?: Discount) => {
    if (discount) {
      setEditing(discount);
      setFormName(discount.name);
      setFormCode(discount.code || '');
      setFormType(discount.type);
      setFormValue(Number(discount.value).toString());
      setFormMinOrder(Number(discount.minOrderAmount).toString());
      setFormMaxUses(discount.maxUses?.toString() || '');
      setFormStartDate(discount.startDate ? discount.startDate.slice(0, 16) : '');
      setFormEndDate(discount.endDate ? discount.endDate.slice(0, 16) : '');
      setFormAppliesTo(discount.appliesTo);
      setFormActive(discount.isActive);
    } else {
      setEditing(null);
      setFormName('');
      setFormCode('');
      setFormType('PERCENTAGE');
      setFormValue('');
      setFormMinOrder('0');
      setFormMaxUses('');
      setFormStartDate('');
      setFormEndDate('');
      setFormAppliesTo('ALL');
      setFormActive(true);
    }
    setOpen(true);
  };

  const save = async () => {
    if (!formName.trim() || !formValue) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        tenantId: TENANT_ID,
        name: formName,
        type: formType,
        value: parseFloat(formValue),
        minOrderAmount: parseFloat(formMinOrder) || 0,
        appliesTo: formAppliesTo,
        isActive: formActive,
      };
      if (formType !== 'FREE_SHIPPING' && formCode.trim()) body.code = formCode.trim();
      if (formMaxUses) body.maxUses = parseInt(formMaxUses);
      if (formStartDate) body.startDate = formStartDate;
      if (formEndDate) body.endDate = formEndDate;

      if (editing) {
        await fetch(`${API_BASE}/discounts/${editing.id}?tenantId=${TENANT_ID}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch(`${API_BASE}/discounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      setOpen(false);
      fetchDiscounts();
    } finally {
      setSaving(false);
    }
  };

  const deleteDiscount = async (id: string) => {
    if (!confirm('Delete this discount? This cannot be undone.')) return;
    await fetch(`${API_BASE}/discounts/${id}?tenantId=${TENANT_ID}`, { method: 'DELETE' });
    fetchDiscounts();
  };

  const toggleActive = async (d: Discount) => {
    await fetch(`${API_BASE}/discounts/${d.id}?tenantId=${TENANT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !d.isActive }),
    });
    fetchDiscounts();
  };

  const viewStats = async (discount: Discount) => {
    setStatsDiscount(discount);
    try {
      const res = await fetch(`${API_BASE}/discounts/${discount.id}/stats?tenantId=${TENANT_ID}`);
      const data = await res.json();
      setStats(data);
    } catch {
      setStats(null);
    }
  };

  const formatValue = (d: Discount): string => {
    if (d.type === 'PERCENTAGE') return `${d.value}%`;
    if (d.type === 'FIXED_AMOUNT') return `$${Number(d.value).toFixed(2)}`;
    return 'Free';
  };

  const usagePercent = (d: Discount) => {
    if (!d.maxUses) return null;
    return Math.min(100, Math.round((d.usedCount / d.maxUses) * 100));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Heading as="h1" className="text-2xl font-bold">Discounts & Coupons</Heading>
        <Button onClick={() => openSheet()}>+ Create Discount</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <Input
              placeholder="Search discounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchDiscounts()}
              className="flex-1 min-w-[200px]"
            />
            <Select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              className="w-40"
            />
            <Button variant="outline" onClick={fetchDiscounts}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Text variant="muted">Loading discounts...</Text>
      ) : discounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Text variant="muted">No discounts found. Create your first discount to get started.</Text>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {discounts.map((d) => {
            const usage = usagePercent(d);
            return (
              <Card key={d.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-1">
                        <Heading as="h3" className="text-base font-semibold">{d.name}</Heading>
                        <Badge variant={d.isActive ? 'success' : 'neutral'}>{d.isActive ? 'Active' : 'Inactive'}</Badge>
                        <Badge variant="info">{d.type}</Badge>
                      </div>
                      {d.code && <Text variant="small" className="font-mono bg-slate-100 px-2 py-0.5 rounded">Code: {d.code}</Text>}
                      <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
                        <span><strong>Value:</strong> {formatValue(d)}</span>
                        {d.minOrderAmount > 0 && <span><strong>Min Order:</strong> ${Number(d.minOrderAmount).toFixed(2)}</span>}
                        {d.maxUses && <span><strong>Uses:</strong> {d.usedCount}/{d.maxUses}</span>}
                        {d.endDate && <span><strong>Expires:</strong> {new Date(d.endDate).toLocaleDateString()}</span>}
                      </div>
                      {usage !== null && (
                        <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                          <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${usage}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => viewStats(d)}>Stats</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(d)}>
                        {d.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openSheet(d)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteDiscount(d.id)}>Delete</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Discount' : 'Create Discount'} side="right">
        <div className="space-y-4 mt-6">
          <div>
            <Label className="text-sm font-medium mb-1 block">Name</Label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Summer Sale 20% Off" />
          </div>
          {formType !== 'FREE_SHIPPING' && (
            <div>
              <Label className="text-sm font-medium mb-1 block">Coupon Code</Label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="SUMMER20 (leave blank for auto-apply)"
              />
            </div>
          )}
          <div>
            <Label className="text-sm font-medium mb-1 block">Type</Label>
            <Select value={formType} onChange={(e) => setFormType(e.target.value)} options={DISCOUNT_TYPES} />
          </div>
          {formType !== 'FREE_SHIPPING' && (
            <div>
              <Label className="text-sm font-medium mb-1 block">
                Value {formType === 'PERCENTAGE' ? '(%)' : '($)'}
              </Label>
              <Input
                type="number"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder={formType === 'PERCENTAGE' ? '20' : '10.00'}
              />
            </div>
          )}
          <div>
            <Label className="text-sm font-medium mb-1 block">Minimum Order Amount ($)</Label>
            <Input type="number" value={formMinOrder} onChange={(e) => setFormMinOrder(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1 block">Max Uses (blank = unlimited)</Label>
            <Input type="number" value={formMaxUses} onChange={(e) => setFormMaxUses(e.target.value)} placeholder="Unlimited" />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1 block">Applies To</Label>
            <Select value={formAppliesTo} onChange={(e) => setFormAppliesTo(e.target.value)} options={APPLIES_TO_OPTIONS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium mb-1 block">Start Date</Label>
              <Input type="datetime-local" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">End Date</Label>
              <Input type="datetime-local" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active-toggle"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <Label htmlFor="active-toggle" className="text-sm cursor-pointer">Active</Label>
          </div>
          <Button className="w-full" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Update Discount' : 'Create Discount'}
          </Button>
        </div>
      </Sheet>

      <Sheet open={!!statsDiscount} onClose={() => { setStatsDiscount(null); setStats(null); }} title={`Stats: ${statsDiscount?.name}`} side="right">
        {stats && (
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="py-4 text-center">
                  <Text variant="small">Total Uses</Text>
                  <Heading as="h3" className="text-2xl font-bold text-indigo-600">{stats.usageCount}</Heading>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <Text variant="small">Revenue Impact</Text>
                  <Heading as="h3" className="text-2xl font-bold text-emerald-600">${stats.totalRevenueImpact.toFixed(2)}</Heading>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <Text variant="small">Avg Order Value</Text>
                  <Heading as="h3" className="text-2xl font-bold text-amber-600">${stats.averageOrderValue.toFixed(2)}</Heading>
                </CardContent>
              </Card>
            </div>
            <div>
              <Text className="text-sm font-medium mb-2 block">Recent Usages</Text>
              {stats.recentUsages.length === 0 ? (
                <Text variant="small" className="text-slate-500">No usages yet</Text>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {stats.recentUsages.map((u, i) => (
                    <div key={i} className="flex justify-between text-sm border-b border-slate-100 pb-2">
                      <span className="text-slate-600">{u.customer?.email || 'Guest'}</span>
                      <span className="font-mono text-slate-500">${u.orderTotal?.toFixed(2)}</span>
                      <span className="text-slate-400 text-xs">{new Date(u.usedAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {stats.usageByDay.length > 0 && (
              <div>
                <Text className="text-sm font-medium mb-2 block">Usage Over Time</Text>
                <div className="flex items-end gap-1 h-[80px]">
                  {stats.usageByDay.map((d, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors relative group"
                      style={{ height: `${Math.max((d.count / Math.max(...stats.usageByDay.map(x => x.count))) * 80, 4)}px` }}
                      title={`${d.date}: ${d.count} uses`}
                    >
                      <span className="sr-only">{d.count} uses</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
