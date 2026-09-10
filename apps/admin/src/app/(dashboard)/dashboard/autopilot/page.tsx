'use client';

import { useState, useCallback, useEffect } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { Heading, Text, Badge, Button, Card, Alert, Tabs, TabPanel, Input, Switch, Select, Skeleton } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Types ────────────────────────────────────────────────────

interface AutopilotStatus {
  enabled: boolean;
  currentLevel: number;
  tasksRunning: number;
  pendingApprovals: number;
  lastActionAt: string | null;
}

interface AutopilotTask {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'queued' | 'completed' | 'failed';
  startedAt: string;
  estimatedCompletion: string | null;
  progress: number;
}

interface AutopilotApproval {
  id: string;
  taskName: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  estimatedImpact: string;
  createdAt: string;
}

interface ActivityLogEntry {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
  status: 'success' | 'failed' | 'pending';
}

interface LevelConfig {
  level: number;
  label: string;
  description: string;
  color: string;
}

// ─── Constants ───────────────────────────────────────────────

const AUTONOMY_LEVELS: LevelConfig[] = [
  {
    level: 1,
    label: 'Suggest Only',
    description: 'ZYRA analyzes and suggests actions. All changes require your explicit approval.',
    color: 'bg-blue-50 border-blue-200 text-blue-800',
  },
  {
    level: 2,
    label: 'Assisted',
    description: 'ZYRA makes routine changes (price adjustments, tags) with post-hoc notification. High-impact actions need approval.',
    color: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  {
    level: 3,
    label: 'Mostly Autonomous',
    description: 'ZYRA executes most actions independently. Only critical decisions (new integrations, major campaigns) require approval.',
    color: 'bg-orange-50 border-orange-200 text-orange-800',
  },
  {
    level: 4,
    label: 'Full Autopilot',
    description: 'ZYRA runs the business autonomously. You receive daily digest summaries. Emergency stop always available.',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
];

const TABS = [
  { value: 'status', label: 'Status' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'approvals', label: 'Approvals' },
  { value: 'activity', label: 'Activity Log' },
];

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const riskBadgeVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
};

const statusConfig: Record<string, { badge: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; label: string }> = {
  running: { badge: 'success', label: 'Running' },
  queued: { badge: 'info', label: 'Queued' },
  completed: { badge: 'neutral', label: 'Completed' },
  failed: { badge: 'danger', label: 'Failed' },
};

const logStatusConfig: Record<string, { badge: 'success' | 'danger' | 'info'; icon: string }> = {
  success: { badge: 'success', icon: '✓' },
  failed: { badge: 'danger', icon: '✗' },
  pending: { badge: 'info', icon: '⟳' },
};

// ─── Page ────────────────────────────────────────────────────

export default function AutopilotPage() {
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const [tasks, setTasks] = useState<AutopilotTask[]>([]);
  const [approvals, setApprovals] = useState<AutopilotApproval[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changingLevel, setChangingLevel] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/autopilot/status?tenantId=${TENANT_ID}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load autopilot status.';
      setError(message);
    }
  }, []);

  const loadAutopilot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, tasksRes, approvalsRes, logRes] = await Promise.all([
        fetch(`${API_BASE}/api/autopilot/status?tenantId=${TENANT_ID}`),
        fetch(`${API_BASE}/api/autopilot/tasks?tenantId=${TENANT_ID}`),
        fetch(`${API_BASE}/api/autopilot/approvals?tenantId=${TENANT_ID}`),
        fetch(`${API_BASE}/api/autopilot/activity?tenantId=${TENANT_ID}&limit=20`),
      ]);

      const anyFail = !statusRes.ok || !tasksRes.ok || !approvalsRes.ok || !logRes.ok;
      if (anyFail) throw new Error('Some autopilot endpoints failed.');

      const [sData, tData, aData, lData] = await Promise.all([
        statusRes.json(),
        tasksRes.json(),
        approvalsRes.json(),
        logRes.json(),
      ]);

      setStatus(sData);
      setTasks(tData.tasks || []);
      setApprovals(aData.approvals || []);
      setActivityLog(lData.log || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load autopilot data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAutopilot();
  }, [loadAutopilot]);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const toggleAutopilot = async () => {
    if (!status) return;
    setChangingLevel(true);
    try {
      const newEnabled = !status.enabled;
      const res = await fetch(`${API_BASE}/api/autopilot/level?tenantId=${TENANT_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setStatus(data);
      showToast('success', `Autopilot ${newEnabled ? 'enabled' : 'disabled'}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to toggle autopilot.';
      showToast('error', message);
    } finally {
      setChangingLevel(false);
    }
  };

  const changeLevel = async (level: string) => {
    setChangingLevel(true);
    try {
      const res = await fetch(`${API_BASE}/api/autopilot/level?tenantId=${TENANT_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: Number(level) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setStatus(data);
      showToast('success', `Autonomy level set to ${level}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to change level.';
      showToast('error', message);
    } finally {
      setChangingLevel(false);
    }
  };

  const runAutopilot = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/autopilot/run?tenantId=${TENANT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'full_cycle' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      showToast('success', 'Autopilot run triggered.');
      // Refresh activity log after a short delay
      setTimeout(loadAutopilot, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to run autopilot.';
      showToast('error', message);
    }
  };

  const approveAutopilotAction = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/autopilot/approvals/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
      if (status) setStatus((prev) => prev ? { ...prev, pendingApprovals: prev.pendingApprovals - 1 } : prev);
      showToast('success', 'Approved.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to approve.';
      showToast('error', message);
    }
  };

  const rejectAutopilotAction = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/autopilot/approvals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
      if (status) setStatus((prev) => prev ? { ...prev, pendingApprovals: prev.pendingApprovals - 1 } : prev);
      showToast('success', 'Rejected.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reject.';
      showToast('error', message);
    }
  };

  const currentLevelConfig = AUTONOMY_LEVELS.find((l) => l.level === status?.currentLevel) || AUTONOMY_LEVELS[0];

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
          { href: '/dashboard/autopilot', label: 'Autopilot', active: true },
        ],
        user: { name: 'Admin', email: 'owner@demo.com', initials: 'A' },
      }}
      headerProps={{
        title: 'Autopilot',
        subtitle: 'Autonomous business operations control',
        actions: (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={runAutopilot}
              disabled={!status?.enabled}
            >
              Run Now
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Autopilot</span>
              <Switch
                checked={status?.enabled ?? false}
                onChange={(e) => {
                  if (e.target.checked) toggleAutopilot();
                  else toggleAutopilot();
                }}
                disabled={changingLevel}
              />
            </div>
          </div>
        ),
      }}
    >
      <div className="space-y-6">
        {/* Error */}
        {error && !loading && (
          <Alert variant="error" title="Error loading autopilot" description={error} />
        )}

        {/* Toast */}
        {toast && (
          <div
            className={cn(
              'fixed top-6 right-6 z-50 rounded-lg px-5 py-3 shadow-lg text-sm font-medium transition-all',
              toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            )}
            role="alert"
          >
            {toast.message}
          </div>
        )}

        {/* Autonomy Level Selector */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Heading as="h4" className="text-base font-semibold text-slate-900">
                Autonomy Level
              </Heading>
              <Text variant="muted" className="mt-1">
                {status?.enabled
                  ? `Currently running at Level ${status.currentLevel}`
                  : 'Autopilot is currently disabled'}
              </Text>
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={String(status?.currentLevel ?? 1)}
                onChange={(e) => changeLevel(e.target.value)}
                options={AUTONOMY_LEVELS.map((l) => ({ value: String(l.level), label: `L${l.level} — ${l.label}` }))}
                disabled={changingLevel || !status?.enabled}
              />
              <Button
                variant={status?.enabled ? 'destructive' : 'default'}
                size="sm"
                onClick={toggleAutopilot}
                disabled={changingLevel}
              >
                {status?.enabled ? 'Stop' : 'Enable'}
              </Button>
            </div>
          </div>

          {/* Current level description */}
          {status?.enabled && (
            <div
              key={status.currentLevel}
              className={`mt-4 rounded-xl border px-4 py-3 ${AUTONOMY_LEVELS.find((l) => l.level === status.currentLevel)?.color || AUTONOMY_LEVELS[0].color}`}
            >
              <p className="text-sm font-medium">
                {AUTONOMY_LEVELS.find((l) => l.level === status.currentLevel)?.description}
              </p>
            </div>
          )}

          {/* All levels overview */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {AUTONOMY_LEVELS.map((lvl) => (
              <div
                key={lvl.level}
                className={cn(
                  'rounded-xl border px-4 py-3 transition-colors cursor-default',
                  lvl.color,
                  status?.currentLevel === lvl.level && status?.enabled
                    ? 'ring-2 ring-indigo-500 ring-offset-1'
                    : 'opacity-70'
                )}
              >
                <p className="text-sm font-semibold">L{lvl.level}: {lvl.label}</p>
                <p className="text-xs mt-1 opacity-80 line-clamp-2">{lvl.description}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Tabs */}
        <Card className="p-6">
          <Tabs defaultValue="status" tabs={TABS}>
            {() => (
              <>
                <TabPanel value="status" activeTab="status">
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : status ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <Text variant="small" className="text-slate-500">Status</Text>
                          <p className={`mt-1 text-base font-semibold ${status.enabled ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {status.enabled ? 'Running' : 'Stopped'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <Text variant="small" className="text-slate-500">Tasks Running</Text>
                          <p className="mt-1 text-base font-semibold text-slate-900">
                            {status.tasksRunning}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <Text variant="small" className="text-slate-500">Pending Approvals</Text>
                          <p className="mt-1 text-base font-semibold text-slate-900">
                            {status.pendingApprovals}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <Text variant="small" className="text-slate-500">Last Action</Text>
                          <p className="mt-1 text-sm font-medium text-slate-900">
                            {formatDate(status.lastActionAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Text variant="muted">No status data available.</Text>
                  )}
                </TabPanel>

                <TabPanel value="tasks" activeTab="tasks">
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="text-4xl">⚙️</div>
                      <Heading as="h4" className="mt-3 text-base font-semibold text-slate-900">
                        No tasks running
                      </Heading>
                      <Text variant="muted" className="mt-1">
                        Tasks appear here when autopilot is active and processing work.
                      </Text>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tasks.map((task) => {
                        const config = statusConfig[task.status] || statusConfig.queued;
                        return (
                          <div key={task.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-slate-900">{task.name}</p>
                                <Badge variant={config.badge}>{config.label}</Badge>
                              </div>
                              <Text variant="small" className="mt-1">{task.description}</Text>
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span>Started: {formatDate(task.startedAt)}</span>
                                {task.estimatedCompletion && (
                                  <span>ETA: {formatDate(task.estimatedCompletion)}</span>
                                )}
                                <span>Progress: {task.progress}%</span>
                              </div>
                              {/* Progress bar */}
                              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
                                <div
                                  className={cn(
                                    'h-1.5 rounded-full transition-all',
                                    task.status === 'running' ? 'bg-emerald-500' :
                                    task.status === 'completed' ? 'bg-slate-400' :
                                    task.status === 'failed' ? 'bg-red-500' : 'bg-blue-400'
                                  )}
                                  style={{ width: `${task.progress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabPanel>

                <TabPanel value="approvals" activeTab="approvals">
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                      ))}
                    </div>
                  ) : approvals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="text-4xl">✅</div>
                      <Heading as="h4" className="mt-3 text-base font-semibold text-slate-900">
                        No pending approvals
                      </Heading>
                      <Text variant="muted" className="mt-1">
                        Autopilot actions that need sign-off will appear here.
                      </Text>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {approvals.map((approval) => (
                        <div
                          key={approval.id}
                          className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-slate-900">{approval.taskName}</p>
                              <Badge variant={riskBadgeVariant[approval.risk] || 'neutral'}>
                                {approval.risk} risk
                              </Badge>
                            </div>
                            <Text variant="small" className="mt-1">{approval.description}</Text>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span>Est. impact: <span className="font-medium text-slate-700">{approval.estimatedImpact}</span></span>
                              <span>Requested: {formatDate(approval.createdAt)}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Button size="sm" onClick={() => approveAutopilotAction(approval.id)}>
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => rejectAutopilotAction(approval.id)}>
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabPanel>

                <TabPanel value="activity" activeTab="activity">
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : activityLog.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="text-4xl">📋</div>
                      <Heading as="h4" className="mt-3 text-base font-semibold text-slate-900">
                        No activity yet
                      </Heading>
                      <Text variant="muted" className="mt-1">
                        Recent autopilot actions will appear here.
                      </Text>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {activityLog.map((entry, idx) => {
                        const cfg = logStatusConfig[entry.status] || logStatusConfig.pending;
                        return (
                          <div
                            key={entry.id}
                            className={cn(
                              'flex items-start gap-3 py-3',
                              idx !== activityLog.length - 1 && 'border-b border-slate-100'
                            )}
                          >
                            <span className={cn(
                              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                              entry.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                              entry.status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            )}>
                              {cfg.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900">{entry.action}</p>
                              <Text variant="small">{entry.detail}</Text>
                            </div>
                            <Text variant="small" className="shrink-0 text-slate-400">
                              {formatDate(entry.timestamp)}
                            </Text>
                          </div>
                        );
                      })}
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
