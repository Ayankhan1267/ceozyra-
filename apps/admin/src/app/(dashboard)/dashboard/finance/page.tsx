'use client';

import { useState, useCallback, useEffect } from 'react';
import DashboardShell from '@/components/DashboardShell';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
  Button, Badge, Heading, Text, Input, Select, Sheet,
} from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Types ──────────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year';

interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

interface ExpenseCategory {
  category: string;
  amount: number;
  count: number;
  pct: number;
}

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  createdAt: string;
}

interface COGSData {
  total: number;
  cogsRatio: number;
}

interface PLData {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  expenses: number;
  netProfit: number;
  netMarginPct: number;
}

interface MetricsData {
  cac: number;
  ltv: number;
  aov: number;
  grossMarginPct: number;
  burnRate: number;
  revenueGrowthPct: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const fmtNumber = (n: number) => new Intl.NumberFormat('en-US').format(n);

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
];

const PERIOD_DAYS: Record<Period, number> = {
  today: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

function daysBetween(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

// ─── Chart helpers (pure CSS bar chart) ────────────────────────────────────────

function CSSBarChart({ data, maxVal }: { data: { label: string; value: number }[]; maxVal?: number }) {
  const peak = maxVal ?? Math.max(...data.map((d) => d.value), 1);
  const BAR_H = 160;

  return (
    <div className="flex items-end gap-1.5" style={{ height: BAR_H + 28 }}>
      {data.map((d, i) => {
        const h = peak > 0 ? Math.max(2, (d.value / peak) * BAR_H) : 2;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
            <div
              className="w-full rounded-t-md bg-indigo-500 transition-all hover:bg-indigo-600 cursor-pointer min-h-[2px]"
              style={{ height: h }}
              title={`${d.label}: ${fmtCurrency(d.value)}`}
            />
            {data.length <= 14 && (
              <span className="text-[9px] text-slate-400 mt-1 truncate w-full text-center leading-none">
                {d.label.replace(/^[A-Za-z]{3}\s/, '').slice(0, 3)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DonutSegment({ pct, color }: { pct: number; color: string }) {
  const r = 38;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <circle
      r={r}
      cx="50%"
      cy="50%"
      fill="transparent"
      stroke={color}
      strokeWidth="14"
      strokeDasharray={circumference}
      strokeDashoffset={offset}
      className="transition-all"
    />
  );
}

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

// ─── Add Expense Dialog ────────────────────────────────────────────────────────

function AddExpenseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cat, setCat] = useState('operations');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const categories = [
    { value: 'operations', label: 'Operations' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'payroll', label: 'Payroll' },
    { value: 'software', label: 'Software' },
    { value: 'logistics', label: 'Logistics' },
    { value: 'other', label: 'Other' },
  ];

  const handleSave = async () => {
    if (!desc.trim() || !amount) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/finance/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID, category: cat, description: desc, amount: Number(amount) }),
      });
      onClose();
      setDesc('');
      setAmount('');
      setCat('operations');
      window.location.reload();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add Expense">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Monthly ad spend" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Amount (USD)</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Saving…' : 'Save Expense'}
        </Button>
      </div>
    </Dialog>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, change, icon, color }: {
  label: string;
  value: string;
  change?: string;
  icon: string;
  color: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Text variant="muted" className="text-xs font-medium uppercase tracking-wider">{label}</Text>
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm ${color}`}>
            {icon}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {change && (
          <Text variant="muted" className={`text-xs mt-1 ${change.startsWith('+') ? 'text-emerald-600' : 'text-red-600'}`}>
            {change} vs prior period
          </Text>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [expenses, setExpenses] = useState<ExpenseCategory[]>([]);
  const [expenseList, setExpenseList] = useState<Expense[]>([]);
  const [cogs, setCogs] = useState<COGSData>({ total: 0, cogsRatio: 0 });
  const [pl, setPl] = useState<PLData>({
    revenue: 0, cogs: 0, grossProfit: 0, grossMarginPct: 0,
    expenses: 0, netProfit: 0, netMarginPct: 0,
  });
  const [metrics, setMetrics] = useState<MetricsData>({
    cac: 0, ltv: 0, aov: 0, grossMarginPct: 0, burnRate: 0, revenueGrowthPct: 0,
  });

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Fetch all data ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const days = PERIOD_DAYS[period];
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const qs = `?tenantId=${TENANT_ID}&startDate=${start}&endDate=${end}`;

      const [revRes, expRes, cogsRes, plRes, metRes] = await Promise.all([
        fetch(`${API_BASE}/api/finance/revenue${qs}`),
        fetch(`${API_BASE}/api/finance/expenses${qs}`),
        fetch(`${API_BASE}/api/finance/cogs${qs}`),
        fetch(`${API_BASE}/api/finance/pl${qs}`),
        fetch(`${API_BASE}/api/finance/metrics${qs}`),
      ]);

      if (!revRes.ok || !expRes.ok || !cogsRes.ok || !plRes.ok || !metRes.ok) {
        throw new Error('Failed to load finance data');
      }

      const revData = await revRes.json();
      const expData = await expRes.json();
      const cogsData = await cogsRes.json();
      const plData = await plRes.json();
      const metData = await metRes.json();

      setRevenue(Array.isArray(revData) ? revData : revData.points || []);
      setExpenses(Array.isArray(expData) ? expData : (expData.byCategory || []));
      setExpenseList(Array.isArray(expData) ? [] : (expData.recent || []));
      setCogs(cogsData);
      setPl(plData);
      setMetrics(metData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load finance data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Chart data: daily revenue bars ──────────────────────────────────────────

  const chartData = revenue.length > 0
    ? revenue.map((r) => ({
        label: r.date.slice(5),
        value: r.revenue,
      }))
    : Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: 0 };
      });

  // ─── Donut data: expense breakdown ───────────────────────────────────────────

  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const donutColors = ['bg-indigo-500', 'bg-violet-500', 'bg-sky-500', 'bg-amber-500', 'bg-rose-500', 'bg-slate-400'];

  return (
    <DashboardShell
      sidebarProps={{
        logo: <span className="text-lg font-bold text-indigo-600">ZYRA</span>,
        navLinks: [
          { href: '/dashboard', label: 'Overview' },
          { href: '/dashboard/finance', label: 'Finance', active: true },
          { href: '/dashboard/analytics', label: 'Analytics' },
          { href: '/dashboard/orders', label: 'Orders' },
          { href: '/dashboard/customers', label: 'Customers' },
        ],
        user: { name: 'Admin', email: 'owner@demo.com', initials: 'A' },
      }}
      headerProps={{
        title: 'Finance',
        subtitle: 'Revenue, profit, and key financial metrics',
        actions: (
          <Select
            options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="w-40"
          />
        ),
      }}
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={loadData} className="underline font-medium">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
                <div className="h-4 w-24 rounded bg-slate-200" />
                <div className="mt-3 h-7 w-32 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* ── P&L Stat Cards ──────────────────────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Revenue" value={fmtCurrency(pl.revenue)} icon="💰" color="bg-indigo-600" change={`${pl.netMarginPct >= 0 ? '+' : ''}${pl.netMarginPct.toFixed(1)}% margin`} />
              <StatCard label="COGS" value={fmtCurrency(pl.cogs)} icon="📦" color="bg-amber-500" change={fmtPct(pl.grossMarginPct) + ' gross margin'} />
              <StatCard label="Gross Profit" value={fmtCurrency(pl.grossProfit)} icon="📈" color="bg-emerald-500" />
              <StatCard label="Net Profit" value={fmtCurrency(pl.netProfit)} icon="💵" color="bg-violet-600" />
            </div>

            {/* ── Daily Revenue Bar Chart ──────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Revenue</CardTitle>
                <CardDescription>Revenue per day over the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <CSSBarChart data={chartData} />
                <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                  <span>Least: {fmtCurrency(Math.min(...chartData.map((d) => d.value)))}</span>
                  <span>Avg: {fmtCurrency(chartData.reduce((s, d) => s + d.value, 0) / chartData.length)}</span>
                  <span>Peak: {fmtCurrency(Math.max(...chartData.map((d) => d.value)))}</span>
                </div>
              </CardContent>
            </Card>

            {/* ── Expense Breakdown + P&L ─────────────────────────────────── */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Expense donut */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Expense Breakdown</CardTitle>
                  <CardDescription>Total: {fmtCurrency(totalExpense)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center">
                    <svg viewBox="0 0 100 100" className="w-40 h-40 -rotate-90">
                      <circle r="38" cx="50" cy="50" fill="transparent" stroke="#f1f5f9" strokeWidth="14" />
                      {expenses.map((cat, i) => (
                        <DonutSegment
                          key={cat.category}
                          pct={totalExpense > 0 ? (cat.amount / totalExpense) * 100 : 0}
                          color={donutColors[i] || 'bg-slate-400'}
                        />
                      ))}
                    </svg>
                    <p className="text-lg font-bold text-slate-900 mt-2">{fmtCurrency(totalExpense)}</p>
                    <p className="text-xs text-slate-500">Total Expenses</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    {expenses.map((cat, i) => (
                      <div key={cat.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`h-3 w-3 rounded-sm ${donutColors[i] || 'bg-slate-400'}`} />
                          <span className="text-sm text-slate-700 capitalize">{cat.category}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium text-slate-900">{fmtCurrency(cat.amount)}</span>
                          <span className="text-xs text-slate-400 ml-2">{cat.pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* P&L Summary */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Profit & Loss Summary</CardTitle>
                  <CardDescription>Full P&L for the selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: 'Revenue', value: pl.revenue, bold: true },
                      { label: 'Cost of Goods Sold', value: -pl.cogs },
                      { label: 'Gross Profit', value: pl.grossProfit, highlight: true },
                      { label: 'Operating Expenses', value: -pl.expenses },
                      { label: 'Net Profit', value: pl.netProfit, bold: true, highlight: pl.netProfit > 0 },
                    ].map((row, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between py-2 ${i < 4 ? 'border-b border-slate-100' : ''} ${row.bold ? 'font-semibold' : ''} ${row.highlight ? 'text-emerald-700' : 'text-slate-700'}`}
                      >
                        <span>{row.label}</span>
                        <span className="font-mono">{fmtCurrency(row.value)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                    <span>Gross Margin: <strong className="text-slate-900">{fmtPct(pl.grossMarginPct)}</strong></span>
                    <span>Net Margin: <strong className="text-slate-900">{fmtPct(pl.netMarginPct)}</strong></span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Key Metrics ────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle>Key Financial Metrics</CardTitle>
                <CardDescription>Core KPIs for the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    { label: 'CAC', value: fmtCurrency(metrics.cac), sub: 'Customer Acquisition Cost' },
                    { label: 'LTV', value: fmtCurrency(metrics.ltv), sub: 'Lifetime Value' },
                    { label: 'AOV', value: fmtCurrency(metrics.aov), sub: 'Avg Order Value' },
                    { label: 'Gross Margin', value: fmtPct(metrics.grossMarginPct), sub: 'Profit after COGS' },
                    { label: 'Burn Rate', value: fmtCurrency(metrics.burnRate), sub: 'Monthly burn' },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                      <Text variant="muted" className="text-xs">{m.sub}</Text>
                      <p className="text-lg font-bold text-slate-900 mt-1">{m.value}</p>
                      <Badge variant="neutral" className="mt-1 text-[10px]">{m.label}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── Expense Table ──────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Expenses</CardTitle>
                    <CardDescription>Detailed expense entries</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddExpense(true)}>
                    + Add Expense
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Category</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {expenseList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                            No expenses recorded for this period.
                          </td>
                        </tr>
                      ) : (
                        expenseList.map((e) => (
                          <tr key={e.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 text-xs text-slate-500">
                              {new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant="neutral" className="capitalize">{e.category}</Badge>
                            </td>
                            <td className="px-4 py-2.5 text-slate-700">{e.description}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-slate-900">{fmtCurrency(e.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <AddExpenseDialog open={showAddExpense} onClose={() => setShowAddExpense(false)} />
      {toast && <Toast type={toast.type} message={toast.message} onDone={() => setToast(null)} />}
    </DashboardShell>
  );
}
