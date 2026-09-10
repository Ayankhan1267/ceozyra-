'use client';

import { useState, useEffect } from 'react';
import { Heading, Text, Badge } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

interface DashboardData {
  overview: {
    totalLeads: number;
    totalCustomers: number;
    totalDeals: number;
    totalCompanies: number;
    totalSegments: number;
    openDeals: number;
    wonDeals: number;
    openDealValue: number;
  };
  leadBreakdown: Record<string, number>;
  dealBreakdown: Record<string, { count: number; value: number }>;
  recentActivities: any[];
}

interface InsightsData {
  period: string;
  metrics: {
    newLeads: number;
    convertedLeads: number;
    newDeals: number;
    wonDeals: number;
    conversionRate: number;
    avgDealValue: number;
    topSources: { source: string; count: number }[];
  };
  pipelinePerformance: { pipelineId: string; pipelineName: string; openDeals: number; openValue: number }[];
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

export default function CrmPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dRes, iRes] = await Promise.all([
        fetch(`${API_BASE}/crm/dashboard?tenantId=${TENANT_ID}`, { cache: 'no-store' }),
        fetch(`${API_BASE}/crm/insights?tenantId=${TENANT_ID}`, { cache: 'no-store' }),
      ]);
      if (dRes.ok) setDashboard(await dRes.json());
      if (iRes.ok) setInsights(await iRes.json());
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6"><Text variant="muted">Loading...</Text></div>;

  return (
    <div className="space-y-6">
      <Heading as="h1" className="text-2xl font-bold">CRM Dashboard</Heading>
      <Text variant="muted">Overview of your sales pipeline and customer data</Text>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={dashboard?.overview.totalLeads ?? 0} />
        <StatCard label="Customers" value={dashboard?.overview.totalCustomers ?? 0} />
        <StatCard label="Open Deals" value={dashboard?.overview.openDeals ?? 0} />
        <StatCard label="Won Deals" value={dashboard?.overview.wonDeals ?? 0} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Companies" value={dashboard?.overview.totalCompanies ?? 0} />
        <StatCard label="Segments" value={dashboard?.overview.totalSegments ?? 0} />
        <StatCard label="Open Pipeline Value" value={fmt(dashboard?.overview.openDealValue ?? 0)} />
        <StatCard label="Conversion Rate" value={insights ? `${insights.metrics.conversionRate}%` : '0%'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lead Breakdown */}
        <div className="rounded-lg border p-4">
          <Heading as="h3" className="text-lg font-semibold mb-3">Lead Breakdown</Heading>
          {dashboard?.leadBreakdown && Object.keys(dashboard.leadBreakdown).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(dashboard.leadBreakdown).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <Text className="text-sm">{status}</Text>
                  <Badge variant="neutral">{count}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <Text variant="muted">No leads yet.</Text>
          )}
        </div>

        {/* Deal Breakdown */}
        <div className="rounded-lg border p-4">
          <Heading as="h3" className="text-lg font-semibold mb-3">Deal Breakdown</Heading>
          {dashboard?.dealBreakdown && Object.keys(dashboard.dealBreakdown).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(dashboard.dealBreakdown).map(([status, info]) => (
                <div key={status} className="flex items-center justify-between">
                  <Text className="text-sm">{status}</Text>
                  <div className="flex items-center gap-2">
                    <Text variant="muted" className="text-xs">{info.count}</Text>
                    <Text variant="muted" className="text-xs">{fmt(info.value)}</Text>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Text variant="muted">No deals yet.</Text>
          )}
        </div>
      </div>

      {/* Insights */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg border p-4">
            <Heading as="h3" className="text-lg font-semibold mb-3">Last 30 Days</Heading>
            <div className="grid grid-cols-2 gap-3">
              <div><Text variant="muted" className="text-xs">New Leads</Text><p className="font-medium">{insights.metrics.newLeads}</p></div>
              <div><Text variant="muted" className="text-xs">Converted</Text><p className="font-medium">{insights.metrics.convertedLeads}</p></div>
              <div><Text variant="muted" className="text-xs">New Deals</Text><p className="font-medium">{insights.metrics.newDeals}</p></div>
              <div><Text variant="muted" className="text-xs">Won Deals</Text><p className="font-medium">{insights.metrics.wonDeals}</p></div>
              <div><Text variant="muted" className="text-xs">Avg Deal Value</Text><p className="font-medium">{fmt(insights.metrics.avgDealValue)}</p></div>
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <Heading as="h3" className="text-lg font-semibold mb-3">Top Sources</Heading>
            {insights.metrics.topSources?.length > 0 ? (
              <div className="space-y-2">
                {insights.metrics.topSources.map((s) => (
                  <div key={s.source} className="flex items-center justify-between">
                    <Text className="text-sm capitalize">{s.source}</Text>
                    <Badge variant="neutral">{s.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <Text variant="muted">No sources recorded.</Text>
            )}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {dashboard?.recentActivities && dashboard.recentActivities.length > 0 && (
        <div className="rounded-lg border p-4">
          <Heading as="h3" className="text-lg font-semibold mb-3">Recent Activity</Heading>
          <div className="space-y-2">
            {dashboard.recentActivities.slice(0, 10).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{a.title || a.type}</span>
                  {a.customer && <Text variant="muted" className="text-xs ml-2">· {a.customer.firstName} {a.customer.lastName}</Text>}
                  {a.lead && <Text variant="muted" className="text-xs ml-2">· {a.lead.firstName} {a.lead.lastName}</Text>}
                </div>
                <Text variant="muted" className="text-xs">{new Date(a.createdAt).toLocaleDateString()}</Text>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-4">
      <Text variant="muted" className="text-xs">{label}</Text>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
