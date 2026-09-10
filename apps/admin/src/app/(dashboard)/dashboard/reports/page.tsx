'use client';

import { useEffect, useState } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@zyra/ui';
import { Button } from '@zyra/ui';
import { Heading, Text } from '@zyra/ui';
import { Badge } from '@zyra/ui';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

interface ReportResult {
  title: string;
  summary: string;
  metrics: Record<string, unknown>;
  recommendations: string[];
  generated_at: string;
}

interface ReportCardDef {
  slug: 'ceo' | 'cfo' | 'cmo' | 'coo' | 'growth';
  name: string;
  description: string;
  icon: string;
  color: string;
}

const AGENT_REPORTS: ReportCardDef[] = [
  {
    slug: 'ceo',
    name: 'CEO Business Overview',
    description: 'Revenue trends, order growth, customer count, and strategic recommendations for executive decision-making.',
    icon: '👔',
    color: 'from-indigo-500 to-blue-600',
  },
  {
    slug: 'cfo',
    name: 'CFO Financial Analysis',
    description: 'Gross margin, COGS, commission liability, net cash flow proxy, and financial health recommendations.',
    icon: '📊',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    slug: 'cmo',
    name: 'CMO Marketing Intelligence',
    description: 'Customer acquisition, repeat buyer ratio, channel breakdown, segment analysis, and top products.',
    icon: '📢',
    color: 'from-pink-500 to-rose-600',
  },
  {
    slug: 'coo',
    name: 'COO Operations Report',
    description: 'Order status distribution, fulfillment times, low-stock alerts, and operational bottlenecks.',
    icon: '⚙️',
    color: 'from-amber-500 to-orange-600',
  },
  {
    slug: 'growth',
    name: 'Growth Analysis',
    description: 'Revenue growth rate, order growth, LTV estimates by segment, top sellers, and growth opportunities.',
    icon: '🚀',
    color: 'from-violet-500 to-purple-600',
  },
];

function AgentReportModal({
  reportDef,
  onClose,
}: {
  reportDef: ReportCardDef;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      try {
        const res = await fetch(`${API_BASE}/v1/agents/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_type: reportDef.slug,
            input: { tenantId: TENANT_ID },
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled && data.output) {
          setResult(data.output);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to generate report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    generate();
    return () => { cancelled = true; };
  }, [reportDef.slug]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{reportDef.icon}</span>
            <h2 className="text-lg font-bold text-slate-900">
              {loading ? 'Generating Report…' : result?.title || reportDef.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="space-y-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200" />
              <div className="mt-6 h-40 animate-pulse rounded-xl bg-slate-100" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">Error: {error}</p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-6">
              <p className="text-sm text-slate-500">
                Generated {new Date(result.generated_at).toLocaleString()}
              </p>

              {/* Summary */}
              <div>
                <Heading as="h4" className="text-base font-semibold text-slate-900">Summary</Heading>
                <Text variant="muted" className="mt-2 leading-relaxed">{result.summary}</Text>
              </div>

              {/* Metrics Table */}
              {Object.keys(result.metrics).length > 0 && (
                <div>
                  <Heading as="h4" className="text-base font-semibold text-slate-900">Key Metrics</Heading>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="pb-2 text-left font-medium text-slate-500">Metric</th>
                          <th className="pb-2 text-right font-medium text-slate-500">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(result.metrics).map(([key, val]) => {
                          const displayVal = typeof val === 'object' && val !== null
                            ? JSON.stringify(val)
                            : String(val ?? '—');
                          const label = key
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (c) => c.toUpperCase());
                          return (
                            <tr key={key} className="border-b border-slate-100 last:border-0">
                              <td className="py-2 text-slate-700">{label}</td>
                              <td className="py-2 text-right font-mono text-slate-900">{displayVal}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations && result.recommendations.length > 0 && (
                <div>
                  <Heading as="h4" className="text-base font-semibold text-slate-900">Recommendations</Heading>
                  <ul className="mt-3 space-y-2">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                        <p className="text-sm text-slate-700">{rec}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4 flex justify-end">
          <Link href={`/dashboard/reports/${reportDef.slug}`}>
            <Button variant="default" size="sm">
              View Full Report →
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ReportsHubPage() {
  const [activeReport, setActiveReport] = useState<ReportCardDef | null>(null);

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
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {AGENT_REPORTS.map((report) => (
          <Card key={report.slug} className="flex flex-col transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${report.color} text-xl text-white shadow-sm`}>
                  {report.icon}
                </div>
                <div>
                  <CardTitle className="text-base">{report.name}</CardTitle>
                  <Badge variant="default" className="mt-1">{report.slug.toUpperCase()} Agent</Badge>
                </div>
              </div>
              <CardDescription className="mt-3">{report.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => setActiveReport(report)}
              >
                Generate Report
              </Button>
              <Link href={`/dashboard/reports/${report.slug}`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  Full Report
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>

      {activeReport && (
        <AgentReportModal
          reportDef={activeReport}
          onClose={() => setActiveReport(null)}
        />
      )}
    </DashboardShell>
  );
}
