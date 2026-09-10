'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { Card, CardContent, CardHeader, CardTitle } from '@zyra/ui';
import { Button } from '@zyra/ui';
import { Heading, Text } from '@zyra/ui';
import { Badge } from '@zyra/ui';
import { Select } from '@zyra/ui';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

type AgentSlug = 'ceo' | 'cfo' | 'cmo' | 'coo' | 'growth';

interface ReportResult {
  title: string;
  summary: string;
  metrics: Record<string, unknown>;
  recommendations: string[];
  generated_at: string;
}

const AGENT_META: Record<AgentSlug, { name: string; icon: string; color: string; gradient: string }> = {
  ceo: {
    name: 'CEO Business Overview',
    icon: '👔',
    color: 'indigo',
    gradient: 'from-indigo-500 to-blue-600',
  },
  cfo: {
    name: 'CFO Financial Analysis',
    icon: '📊',
    color: 'emerald',
    gradient: 'from-emerald-500 to-teal-600',
  },
  cmo: {
    name: 'CMO Marketing Intelligence',
    icon: '📢',
    color: 'pink',
    gradient: 'from-pink-500 to-rose-600',
  },
  coo: {
    name: 'COO Operations Report',
    icon: '⚙️',
    color: 'amber',
    gradient: 'from-amber-500 to-orange-600',
  },
  growth: {
    name: 'Growth Analysis',
    icon: '🚀',
    color: 'violet',
    gradient: 'from-violet-500 to-purple-600',
  },
};

const DATE_RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

function buildDateRange(option: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();
  const days = option === '7d' ? 7 : option === '90d' ? 90 : 30;
  const start = new Date(now.getTime() - days * 86400_000).toISOString();
  return { start, end };
}

interface PageProps {
  params: Promise<{ agent: string }>;
}

function isAgentSlug(val: string): val is AgentSlug {
  return ['ceo', 'cfo', 'cmo', 'coo', 'growth'].includes(val);
}

export default async function AgentReportPage({ params }: PageProps) {
  return <ReportInner params={params} />;
}

function ReportInner({ params }: PageProps) {
  const [agentSlug, setAgentSlug] = useState<AgentSlug | null>(null);
  const [dateRange, setDateRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolvedParams = params;

  // Unwrap params promise - Next.js passes resolved params in App Router
  const [resolvedAgent, setResolvedAgent] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    Promise.resolve(resolvedParams).then((p) => {
      setResolvedAgent(p.agent);
      setMounted(true);
    });
  }, [resolvedParams]);

  useEffect(() => {
    if (!mounted) return;
    const slug = resolvedAgent.toLowerCase();
    if (isAgentSlug(slug)) {
      setAgentSlug(slug);
    }
  }, [mounted, resolvedAgent]);

  const fetchReport = useCallback(async (slug: AgentSlug, range: string) => {
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const { start, end } = buildDateRange(range);
      const res = await fetch(`${API_BASE}/v1/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_type: slug,
          input: {
            tenantId: TENANT_ID,
            dateRange: { start, end },
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (data.output) {
        setReport(data.output);
      } else {
        setError('No output received from agent');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!agentSlug) return;
    fetchReport(agentSlug, dateRange);
  }, [agentSlug, dateRange, fetchReport]);

  if (!mounted || !agentSlug) {
    return (
      <DashboardShell
        sidebarProps={{
          logo: <span className="text-lg font-bold text-indigo-600">ZYRA</span>,
          navLinks: [
            { href: '/dashboard', label: 'Overview' },
            { href: '/dashboard/chat', label: 'Talk to ZYRA' },
            { href: '/dashboard/approvals', label: 'Approvals' },
            { href: '/dashboard/orders', label: 'Orders' },
            { href: '/dashboard/products', label: 'Products' },
            { href: '/dashboard/customers', label: 'Customers' },
            { href: '/dashboard/finance', label: 'Finance' },
            { href: '/dashboard/reports', label: 'Reports', active: true },
          ],
          user: { name: 'Admin', email: 'owner@demo.com', initials: 'A' },
        }}
        headerProps={{
          title: 'AI Reports',
          subtitle: 'Executive agent reports for your business',
        }}
      >
        <div className="flex h-96 items-center justify-center">
          <div className="text-slate-500">Loading…</div>
        </div>
      </DashboardShell>
    );
  }

  const meta = AGENT_META[agentSlug];

  return (
    <DashboardShell
      sidebarProps={{
        logo: <span className="text-lg font-bold text-indigo-600">ZYRA</span>,
        navLinks: [
          { href: '/dashboard', label: 'Overview' },
          { href: '/dashboard/chat', label: 'Talk to ZYRA' },
          { href: '/dashboard/approvals', label: 'Approvals' },
          { href: '/dashboard/orders', label: 'Orders' },
          { href: '/dashboard/products', label: 'Products' },
          { href: '/dashboard/customers', label: 'Customers' },
          { href: '/dashboard/finance', label: 'Finance' },
          { href: '/dashboard/reports', label: 'Reports', active: true },
        ],
        user: { name: 'Admin', email: 'owner@demo.com', initials: 'A' },
      }}
      headerProps={{
        title: meta.name,
        subtitle: `Generated by ${agentSlug.toUpperCase()} Agent`,
        breadcrumbs: [
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports', href: '/dashboard/reports' },
          { label: meta.name, active: true },
        ],
      }}
    >
      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/dashboard/reports">
          <Button variant="outline" size="sm">
            ← All Reports
          </Button>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <Select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            options={DATE_RANGE_OPTIONS}
            className="w-40"
          />
          <Button
            size="sm"
            onClick={() => fetchReport(agentSlug, dateRange)}
            disabled={loading}
          >
            {loading ? 'Generating…' : 'Regenerate'}
          </Button>
        </div>
      </div>

      {/* Agent Badge */}
      <div className="mb-6 flex items-center gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.gradient} text-2xl text-white shadow-lg`}>
          {meta.icon}
        </div>
        <div>
          <Badge variant="default" className="uppercase">{agentSlug} Agent</Badge>
          <p className="mt-1 text-xs text-slate-500">
            {report ? `Last generated: ${new Date(report.generated_at).toLocaleString()}` : 'Not yet generated'}
          </p>
        </div>
      </div>

      {/* Report Content */}
      {loading && (
        <Card>
          <CardContent className="p-8">
            <div className="space-y-4">
              <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200" />
              <div className="mt-6 grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="p-8">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">Error: {error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => fetchReport(agentSlug, dateRange)}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {report && !loading && (
        <div className="space-y-6">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Text variant="muted" className="leading-relaxed">{report.summary}</Text>
            </CardContent>
          </Card>

          {/* Metrics Grid */}
          {Object.keys(report.metrics).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Key Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(report.metrics).map(([key, val]) => {
                    let displayVal: string;
                    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                      displayVal = JSON.stringify(val);
                    } else if (Array.isArray(val)) {
                      displayVal = val.map((v: unknown) => {
                        if (typeof v === 'object' && v !== null) {
                          const obj = v as Record<string, unknown>;
                          if (obj.name) {
                            return `${obj.name}: ${obj.revenue ?? ''}`;
                          }
                          return JSON.stringify(v);
                        }
                        return String(v);
                      }).join('; ');
                    } else {
                      displayVal = val === null || val === undefined ? '—' : String(val);
                    }
                    const label = key
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase());
                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-slate-100 bg-slate-50/50 p-3"
                      >
                        <p className="text-xs font-medium text-slate-500">{label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 break-all">
                          {displayVal}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {report.recommendations && report.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {report.recommendations.map((rec, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-lg bg-indigo-50 p-4"
                    >
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                      <p className="text-sm text-slate-700 leading-relaxed">{rec}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
