'use client';

import { useState, useCallback, useEffect } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { Heading, Text, Badge, Button, Card, Alert, Tabs, TabPanel, Input, Switch } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Types ────────────────────────────────────────────────────

interface RadarHealth {
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  lastChecked: string;
  breakdown: Record<string, number>;
}

interface AlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  source: string;
  createdAt: string;
  acknowledged: boolean;
}

interface Opportunity {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  estimatedRevenue: number | null;
  category: string;
}

// ─── Helpers ─────────────────────────────────────────────────

const healthColor = (score: number) => {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-600';
};

const healthBg = (score: number) => {
  if (score >= 70) return 'bg-emerald-50 border-emerald-200';
  if (score >= 40) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
};

const healthStrokeColor = (score: number) => {
  if (score >= 70) return '#10B981';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
};

const severityConfig: Record<string, { badge: 'danger' | 'warning' | 'info'; icon: string }> = {
  critical: { badge: 'danger', icon: '🔴' },
  warning: { badge: 'warning', icon: '🟡' },
  info: { badge: 'info', icon: '🔵' },
};

const impactColors: Record<string, 'success' | 'warning' | 'neutral'> = {
  high: 'success',
  medium: 'warning',
  low: 'neutral',
};

const effortLabels: Record<string, string> = {
  low: 'Low Effort',
  medium: 'Medium Effort',
  high: 'High Effort',
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

// ─── Components ──────────────────────────────────────────────

function HealthScoreCircle({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg className="h-40 w-40 -rotate-90" viewBox="0 0 140 140">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="10"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={healthStrokeColor(score)}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-4xl font-bold ${healthColor(score)}`}>{score}</span>
        <span className="text-xs text-slate-500 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────

export default function RadarPage() {
  const [health, setHealth] = useState<RadarHealth | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadRadar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, alertsRes, oppRes] = await Promise.all([
        fetch(`${API_BASE}/api/radar/health?tenantId=${TENANT_ID}`),
        fetch(`${API_BASE}/api/radar/alerts?tenantId=${TENANT_ID}&limit=50`),
        fetch(`${API_BASE}/api/radar/opportunities?tenantId=${TENANT_ID}`),
      ]);

      if (!healthRes.ok || !alertsRes.ok || !oppRes.ok) {
        throw new Error(`HTTP error: health=${healthRes.status}, alerts=${alertsRes.status}, opp=${oppRes.status}`);
      }

      const healthData = await healthRes.json();
      const alertsData = await alertsRes.json();
      const oppData = await oppRes.json();

      setHealth(healthData);
      setAlerts(alertsData.alerts || []);
      setOpportunities(oppData.opportunities || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load radar data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRadar();
  }, [loadRadar]);

  // Auto-refresh every 30s when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadRadar, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadRadar]);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const dismissAlert = async (id: string) => {
    setDismissing(id);
    try {
      const res = await fetch(`${API_BASE}/api/radar/alerts/${id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      showToast('success', 'Alert dismissed.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to dismiss alert.';
      showToast('error', message);
    } finally {
      setDismissing(null);
    }
  };

  const acknowledgeAlert = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/radar/alerts/${id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
      );
      showToast('success', 'Alert acknowledged.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to acknowledge alert.';
      showToast('error', message);
    }
  };

  const groupedAlerts = alerts.reduce<Record<string, AlertItem[]>>((acc, a) => {
    const key = a.severity.charAt(0).toUpperCase() + a.severity.slice(1);
    acc[key] = acc[key] || [];
    acc[key].push(a);
    return acc;
  }, {});

  const alertGroups = ['Critical', 'Warning', 'Info'];

  const scoreLabel =
    health && health.score >= 70 ? 'Healthy' : health && health.score >= 40 ? 'At Risk' : 'Critical';

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
          { href: '/dashboard/radar', label: 'Radar', active: true },
        ],
        user: { name: 'Admin', email: 'owner@demo.com', initials: 'A' },
      }}
      headerProps={{
        title: 'Business Radar',
        subtitle: 'Health scores, alerts, and growth opportunities',
        actions: (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto-refresh
            </label>
            <Button variant="outline" size="sm" onClick={loadRadar}>
              Refresh
            </Button>
          </div>
        ),
      }}
    >
      <div className="space-y-6">
        {/* Error */}
        {error && !loading && (
          <Alert variant="error" title="Error loading radar" description={error} />
        )}

        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-6 right-6 z-50 rounded-lg px-5 py-3 shadow-lg text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
            }`}
            role="alert"
          >
            {toast.message}
          </div>
        )}

        {/* Top: Health Score + Alerts Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Health Score */}
          <Card className={`p-6 border ${healthBg(health?.score ?? 0)}`}>
            <Heading as="h4" className="text-base font-semibold text-slate-900">
              Overall Health Score
            </Heading>
            <Text variant="muted" className="mt-1">
              Last checked: {health ? formatDate(health.lastChecked) : '—'}
            </Text>
            <div className="mt-4 flex flex-col items-center">
              {loading ? (
                <div className="h-40 w-40 rounded-full bg-slate-200 animate-pulse" />
              ) : health ? (
                <>
                  <HealthScoreCircle score={health.score} />
                  <Badge
                    variant={health.score >= 70 ? 'success' : health.score >= 40 ? 'warning' : 'danger'}
                    className="mt-3"
                  >
                    {scoreLabel}
                  </Badge>
                </>
              ) : (
                <p className="text-sm text-slate-500 mt-8">No data available</p>
              )}
            </div>
            {health && health.breakdown && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {Object.entries(health.breakdown).map(([key, val]) => (
                  <div key={key} className="rounded-lg bg-white/60 px-3 py-2">
                    <Text variant="small" className="capitalize">{key}</Text>
                    <p className="text-sm font-semibold text-slate-900">{val}/100</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Alerts Summary */}
          <Card className="lg:col-span-2 p-6">
            <Heading as="h4" className="text-base font-semibold text-slate-900">
              Alerts Summary
            </Heading>
            <Text variant="muted" className="mt-1">
              {alerts.filter((a) => !a.acknowledged).length} unacknowledged of {alerts.length} total
            </Text>
            {loading ? (
              <div className="mt-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-slate-200 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-3">
                {alertGroups.map((group) => {
                  const groupAlerts = groupedAlerts[group] || [];
                  const unack = groupAlerts.filter((a) => !a.acknowledged).length;
                  return (
                    <div
                      key={group}
                      className={`flex flex-col items-center rounded-xl border px-5 py-3 ${
                        group === 'Critical'
                          ? 'border-red-200 bg-red-50'
                          : group === 'Warning'
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-blue-200 bg-blue-50'
                      }`}
                    >
                      <span className="text-2xl font-bold text-slate-900">{groupAlerts.length}</span>
                      <span className="text-xs text-slate-500">{group}</span>
                      {unack > 0 && (
                        <Badge variant={group === 'Critical' ? 'danger' : group === 'Warning' ? 'warning' : 'info'}>
                          {unack} new
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Tabs: Alerts | Opportunities */}
        <Card className="p-6">
          <Tabs
            defaultValue="alerts"
            tabs={[
              { value: 'alerts', label: `Alerts (${alerts.length})` },
              { value: 'opportunities', label: `Opportunities (${opportunities.length})` },
            ]}
          >
            {() => (
              <>
                <TabPanel value="alerts" activeTab="alerts">
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 rounded-lg bg-slate-200 animate-pulse" />
                      ))}
                    </div>
                  ) : alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="text-4xl">✅</div>
                      <Heading as="h4" className="mt-3 text-base font-semibold text-slate-900">
                        All clear
                      </Heading>
                      <Text variant="muted" className="mt-1">
                        No alerts at this time.
                      </Text>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {alertGroups.map((group) => {
                        const groupAlerts = groupedAlerts[group] || [];
                        if (groupAlerts.length === 0) return null;
                        return (
                          <div key={group}>
                            <Heading as="h5" className="text-sm font-semibold text-slate-700 mb-3">
                              {group}
                            </Heading>
                            <div className="space-y-2">
                              {groupAlerts.map((alert) => {
                                const config = severityConfig[alert.severity] || severityConfig.info;
                                return (
                                  <div
                                    key={alert.id}
                                    className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
                                      alert.severity === 'critical'
                                        ? 'border-red-200 bg-red-50/50'
                                        : alert.severity === 'warning'
                                        ? 'border-amber-200 bg-amber-50/50'
                                        : 'border-blue-200 bg-blue-50/50'
                                    }`}
                                  >
                                    <span className="text-lg mt-0.5">{config.icon}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                                        <Badge variant={config.badge}>{alert.severity}</Badge>
                                        {alert.acknowledged && (
                                          <Badge variant="neutral">Acknowledged</Badge>
                                        )}
                                      </div>
                                      <Text variant="small" className="mt-1">{alert.description}</Text>
                                      <Text variant="small" className="mt-1 text-slate-400">
                                        {alert.source} · {formatDate(alert.createdAt)}
                                      </Text>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                      {!alert.acknowledged && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => acknowledgeAlert(alert.id)}
                                        >
                                          Acknowledge
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => dismissAlert(alert.id)}
                                        disabled={dismissing === alert.id}
                                      >
                                        {dismissing === alert.id ? 'Dismissing...' : 'Dismiss'}
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabPanel>

                <TabPanel value="opportunities" activeTab="opportunities">
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 rounded-lg bg-slate-200 animate-pulse" />
                      ))}
                    </div>
                  ) : opportunities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="text-4xl">💡</div>
                      <Heading as="h4" className="mt-3 text-base font-semibold text-slate-900">
                        No opportunities yet
                      </Heading>
                      <Text variant="muted" className="mt-1">
                        Opportunities appear when the system detects actionable growth signals.
                      </Text>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {opportunities.map((opp) => (
                        <Card key={opp.id} className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-slate-900">{opp.title}</p>
                              <Text variant="small" className="mt-1">{opp.description}</Text>
                            </div>
                            <Badge variant={impactColors[opp.impact] || 'neutral'}>{opp.impact} impact</Badge>
                          </div>
                          <Separator className="my-3" />
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="neutral">{opp.category}</Badge>
                            <span className="text-xs text-slate-500">Effort: {effortLabels[opp.effort] || opp.effort}</span>
                            {opp.estimatedRevenue != null && (
                              <Badge variant="success">
                                ~${opp.estimatedRevenue.toLocaleString()} est.
                              </Badge>
                            )}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" variant="default">Act on this</Button>
                            <Button size="sm" variant="ghost">Dismiss</Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabPanel>
              </>
            )}
          </Tabs>
        </Card>
      </div>
    </DashboardShell>
  );
}
