'use client';

import { useEffect, useState } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { Heading, Text, Badge, Button } from '@zyra/ui';
import { Card, CardContent } from '@zyra/ui';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';

interface MetricCard {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'neutral';
}

interface AgentActivity {
  name: string;
  task: string;
  status: string;
  color: string;
}

interface HealthScore {
  overall_score: number;
  grade: string;
  factors: { name: string; score: number; weight: number; status: string }[];
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [agents, setAgents] = useState<AgentActivity[]>([]);
  const [health, setHealth] = useState<HealthScore | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [revenueRes, insightsRes, agentRes, healthRes] = await Promise.all([
          fetch(`${API_BASE}/api/analytics/revenue/tenant/cmtsybniv005krtzxn2up82q4`),
          fetch(`${API_BASE}/api/agent/insights`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId: 'cmtsybniv005krtzxn2up82q4' }),
          }),
          fetch(`${API_BASE}/api/agent/list/tenant/cmtsybniv005krtzxn2up82q4`),
          fetch(`${API_BASE}/api/dashboard/health-score/cmtsybniv005krtzxn2up82q4`),
        ]);

        if (cancelled) return;

        const revenueData = revenueRes.ok ? await revenueRes.json() : null;
        const insightsData = insightsRes.ok ? await insightsRes.json() : null;
        const agentData = agentRes.ok ? await agentRes.json() : null;
        const healthData = healthRes.ok ? await healthRes.json() : null;

        if (revenueData) {
          setMetrics([
            { label: 'Revenue', value: `$${revenueData.revenue?.toLocaleString() || '0'}`, delta: '+18.2%', trend: 'up' },
            { label: 'Orders', value: revenueData.orders?.toLocaleString() || '0', delta: '+12.4%', trend: 'up' },
            { label: 'AOV', value: `$${revenueData.aov?.toFixed(2) || '0.00'}`, delta: '+5.1%', trend: 'up' },
            { label: 'Products', value: revenueData.activeProducts?.toString() || '0', delta: 'Active', trend: 'neutral' },
          ]);
        }

        if (insightsData?.insights) {
          setInsights(insightsData.insights.slice(0, 4).map((i: any) => i.title));
        }

        if (agentData?.agents) {
          setAgents(agentData.agents.slice(0, 5).map((a: any) => ({
            name: a.name || 'Agent',
            task: a.description || 'Idle',
            status: a.isActive ? 'Running' : 'Inactive',
            color: 'bg-indigo-500',
          })));
        }

        if (healthData) {
          setHealth(healthData);
        }
      } catch {
        // Use defaults
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHealthLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const gradeColors: Record<string, { bg: string; text: string; ring: string }> = {
    A: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-500' },
    B: { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-500' },
    C: { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-500' },
    D: { bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-500' },
    F: { bg: 'bg-red-100', text: 'text-red-700', ring: 'ring-red-500' },
  };

  const gradeColor = health ? gradeColors[health.grade] || gradeColors['F'] : null;
  const circumference = 2 * Math.PI * 54;
  const healthOffset = health ? circumference - (health.overall_score / 100) * circumference : circumference;

  return (
    <DashboardShell
      sidebarProps={{
        logo: <span className="text-lg font-bold text-indigo-600">ZYRA</span>,
        navLinks: [
          { href: '/dashboard', label: 'Overview', active: true },
          { href: '/dashboard/chat', label: 'Talk to ZYRA' },
          { href: '/dashboard/approvals', label: 'Approvals' },
          { href: '/dashboard/orders', label: 'Orders' },
          { href: '/dashboard/products', label: 'Products' },
          { href: '/dashboard/customers', label: 'Customers' },
          { href: '/dashboard/finance', label: 'Finance' },
          { href: '/dashboard/reports', label: 'Reports' },
        ],
        user: { name: 'Admin', email: 'owner@demo.com', initials: 'A' },
      }}
      headerProps={{
        title: 'Dashboard',
        subtitle: 'Business overview & AI insights',
      }}
    >
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-6">
              <div className="h-4 w-20 rounded bg-slate-200" />
              <div className="mt-4 h-8 w-32 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-16 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Health Score Widget */}
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
                {/* Circular Health Score */}
                <div className="flex flex-col items-center">
                  {healthLoading ? (
                    <div className="h-36 w-36 animate-pulse rounded-full bg-slate-200" />
                  ) : health ? (
                    <>
                      <div className="relative h-36 w-36">
                        <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120">
                          {/* Background ring */}
                          <circle
                            cx="60" cy="60" r="54"
                            fill="none"
                            strokeWidth="8"
                            className="text-slate-100"
                            stroke="currentColor"
                          />
                          {/* Score ring */}
                          <circle
                            cx="60" cy="60" r="54"
                            fill="none"
                            strokeWidth="8"
                            strokeLinecap="round"
                            className={gradeColor?.ring.replace('ring-', 'text-') || 'text-slate-400'}
                            stroke="currentColor"
                            style={{
                              strokeDasharray: circumference,
                              strokeDashoffset: healthOffset,
                              transition: 'stroke-dashoffset 1s ease-out',
                            }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-3xl font-bold text-slate-900">{health.overall_score}</span>
                          <span className={`text-sm font-bold ${gradeColor?.text}`}>{health.grade}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Health Score</p>
                    </>
                  ) : (
                    <div className="h-36 w-36 rounded-full border-4 border-slate-200 flex items-center justify-center">
                      <span className="text-slate-400 text-sm">—</span>
                    </div>
                  )}
                </div>

                {/* Health Factors */}
                <div className="flex-1 w-full">
                  <Heading as="h3" className="text-base font-semibold text-slate-900">Business Health</Heading>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {health?.factors.map((factor) => {
                      const factorColor =
                        factor.status === 'good'
                          ? 'text-emerald-600 bg-emerald-50'
                          : factor.status === 'warning'
                            ? 'text-amber-600 bg-amber-50'
                            : 'text-red-600 bg-red-50';
                      return (
                        <div key={factor.name} className="rounded-lg border border-slate-100 bg-white p-3 text-center">
                          <p className="text-xs text-slate-500">{factor.name}</p>
                          <p className="mt-1 text-lg font-bold text-slate-900">{factor.score}</p>
                          <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs font-medium ${factorColor}`}>
                            {factor.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CTA */}
                <div className="shrink-0">
                  <Link href="/dashboard/reports">
                    <Button variant="default" size="md">
                      View Reports →
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metrics Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-xl border border-slate-200 bg-white p-6">
                <p className="text-sm font-medium text-slate-500">{m.label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{m.value}</p>
                <p className={`mt-1 text-sm font-medium ${m.trend === 'up' ? 'text-emerald-600' : m.trend === 'down' ? 'text-red-600' : 'text-slate-500'}`}>
                  {m.delta}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* AI Insights */}
            <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6">
              <Heading as="h3" className="text-lg font-semibold text-slate-900">AI Insights</Heading>
              <div className="mt-4 space-y-3">
                {insights.length > 0 ? insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-indigo-50 p-3">
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                    <p className="text-sm text-slate-700">{insight}</p>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">No insights available yet. Add data to see AI-generated insights.</p>
                )}
              </div>
            </div>

            {/* Agent Activity */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <Heading as="h3" className="text-lg font-semibold text-slate-900">Agent Activity</Heading>
              <div className="mt-4 space-y-3">
                {agents.length > 0 ? agents.map((a) => (
                  <div key={a.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2 w-2 rounded-full ${a.color}`} />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{a.name}</p>
                        <p className="text-xs text-slate-500">{a.task}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.status === 'Running' ? 'bg-indigo-100 text-indigo-700' : a.status === 'Done' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {a.status}
                    </span>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">No agents configured yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <Heading as="h3" className="text-lg font-semibold text-slate-900">Quick Actions</Heading>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="/dashboard/chat" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white hover:from-indigo-700 hover:to-violet-700">
                Talk to ZYRA
              </a>
              <a href="/dashboard/approvals" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                View Approvals
              </a>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
