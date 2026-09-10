'use client';

import { useState, useCallback, useEffect } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Button, Badge, Heading, Text, Alert, Switch, Skeleton } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Types ──────────────────────────────────────────────────────────────────────

type IntegrationDef = {
  id: string;
  name: string;
  slug: 'meta' | 'google';
  description: string;
  icon: string;
  color: string;
  status: 'disconnected' | 'connected' | 'error';
  lastSyncAt?: string;
};

type IntegrationConnection = {
  id: string;
  connected: boolean;
  accountName?: string;
  connectedAt?: string;
};

// ─── Integration Config ─────────────────────────────────────────────────────────

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: 'meta',
    name: 'Meta Ads',
    slug: 'meta',
    description: 'Connect your Meta Ads account to sync campaign performance, spend, and conversions into ZYRA.',
    icon: '📘',
    color: 'bg-blue-600',
    status: 'disconnected',
  },
  {
    id: 'google',
    name: 'Google Ads',
    slug: 'google',
    description: 'Link Google Ads to import keyword data, spend, and campaign metrics directly into your dashboard.',
    icon: '🔍',
    color: 'bg-red-500',
    status: 'disconnected',
  },
];

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

// ─── Integration Card ──────────────────────────────────────────────────────────

function IntegrationCard({ def, onStatusChange }: { def: IntegrationDef; onStatusChange: (id: string, status: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connection, setConnection] = useState<IntegrationConnection | null>(null);
  const [campaigns, setCampaigns] = useState<{ name: string; status: string; spend: number; impressions: number }[]>([]);
  const [showCampaigns, setShowCampaigns] = useState(false);

  const loadConnection = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations/${def.slug}/connection?tenantId=${TENANT_ID}`);
      if (res.ok) {
        const data: IntegrationConnection = await res.json();
        setConnection(data);
        onStatusChange(def.id, data.connected ? 'connected' : 'disconnected');
      }
    } catch {
      // silent
    }
  }, [def.slug, def.id, onStatusChange]);

  useEffect(() => {
    loadConnection();
  }, [loadConnection]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/${def.slug}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      const data: IntegrationConnection = await res.json();
      setConnection(data);
      onStatusChange(def.id, data.connected ? 'connected' : 'error');
    } catch (err: unknown) {
      onStatusChange(def.id, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/${def.slug}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      });
      if (!res.ok) throw new Error('Failed to disconnect');
      setConnection(null);
      onStatusChange(def.id, 'disconnected');
      setShowCampaigns(false);
      setCampaigns([]);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/${def.slug}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID }),
      });
      if (!res.ok) throw new Error('Sync failed');
      await loadConnection();
    } catch {
      // silent
    } finally {
      setSyncing(false);
    }
  };

  const loadCampaigns = async () => {
    setShowCampaigns(true);
    try {
      const endpoint = def.slug === 'meta'
        ? `/api/integrations/meta/campaigns`
        : `/api/integrations/google/campaigns`;
      const res = await fetch(`${API_BASE}${endpoint}?tenantId=${TENANT_ID}`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(Array.isArray(data) ? data : data.campaigns || []);
      }
    } catch {
      // silent
    }
  };

  const isConnected = connection?.connected ?? false;
  const statusBadge = isConnected
    ? { variant: 'success' as const, label: 'Connected' }
    : { variant: 'neutral' as const, label: 'Disconnected' };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl ${def.color} flex items-center justify-center text-white text-xl shadow-sm`}>
              {def.icon}
            </div>
            <div>
              <CardTitle className="text-base">{def.name}</CardTitle>
              <Badge variant={statusBadge.variant} className="mt-1">
                {statusBadge.label}
              </Badge>
            </div>
          </div>
          {isConnected && (
            <Switch
              checked={isConnected}
              onChange={handleDisconnect}
              label=""
            />
          )}
        </div>
        <CardDescription className="mt-3">{def.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        {isConnected && connection && (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
              <Text variant="small">Account</Text>
              <Text className="text-sm font-medium text-slate-900">{connection.accountName || 'Connected Account'}</Text>
            </div>
            {connection.connectedAt && (
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                <Text variant="small">Connected</Text>
                <Text className="text-sm text-slate-600">
                  {new Date(connection.connectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </div>
            )}
          </div>
        )}

        {isConnected && showCampaigns && (
          <div className="mt-4">
            <Heading as="h5" className="text-sm font-semibold text-slate-900 mb-2">Campaigns</Heading>
            {campaigns.length === 0 ? (
              <Text variant="small">No campaigns found or still loading.</Text>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-2 py-1.5 text-xs font-medium text-slate-500">Name</th>
                      <th className="text-left px-2 py-1.5 text-xs font-medium text-slate-500">Status</th>
                      <th className="text-right px-2 py-1.5 text-xs font-medium text-slate-500">Spend</th>
                      <th className="text-right px-2 py-1.5 text-xs font-medium text-slate-500">Impressions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {campaigns.slice(0, 5).map((c, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5 text-sm text-slate-900 max-w-[160px] truncate">{c.name}</td>
                        <td className="px-2 py-1.5"><Badge variant={c.status === 'ACTIVE' ? 'success' : 'neutral'}>{c.status}</Badge></td>
                        <td className="px-2 py-1.5 text-right text-xs text-slate-600">{fmtCurrency(c.spend)}</td>
                        <td className="px-2 py-1.5 text-right text-xs text-slate-600">{fmtNum(c.impressions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center gap-2">
        {!isConnected ? (
          <Button onClick={handleConnect} disabled={loading} className="flex-1">
            {loading ? 'Connecting…' : 'Connect'}
          </Button>
        ) : (
          <>
            <Button variant="default" size="sm" onClick={handleSync} disabled={syncing} className="flex-1">
              {syncing ? 'Syncing…' : 'Sync Now'}
            </Button>
            {!showCampaigns && (
              <Button variant="outline" size="sm" onClick={loadCampaigns} className="flex-1">
                View Campaigns
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={loading}>
              Disconnect
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleStatusChange = useCallback((id: string, status: string) => {
    setStatuses((prev) => ({ ...prev, [id]: status }));
  }, []);

  return (
    <DashboardShell
      sidebarProps={{
        logo: <span className="text-lg font-bold text-indigo-600">ZYRA</span>,
        navLinks: [
          { href: '/dashboard', label: 'Overview' },
          { href: '/dashboard/integrations', label: 'Integrations', active: true },
          { href: '/dashboard/finance', label: 'Finance' },
          { href: '/dashboard/analytics', label: 'Analytics' },
          { href: '/dashboard/orders', label: 'Orders' },
        ],
        user: { name: 'Admin', email: 'owner@demo.com', initials: 'A' },
      }}
      headerProps={{
        title: 'Integrations',
        subtitle: 'Connect and manage external advertising platforms',
      }}
    >
      <div className="space-y-6">
        {INTEGRATIONS.some((i) => statuses[i.id] === 'error') && (
          <Alert variant="error" title="Connection Error" description="One or more integrations failed to connect. Please try again or check your credentials." />
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          {INTEGRATIONS.map((def) => (
            <IntegrationCard key={def.id} def={def} onStatusChange={handleStatusChange} />
          ))}
        </div>

        {/* Setup instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Setup Guide</CardTitle>
            <CardDescription>How to connect your ad accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <Heading as="h5" className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="text-blue-600">📘</span> Meta Ads Setup
                </Heading>
                <ol className="mt-2 text-xs text-slate-600 space-y-1.5 list-decimal list-inside">
                  <li>Create a Meta Business App at developers.facebook.com</li>
                  <li>Add <code className="bg-slate-100 px-1 rounded">ads_management</code> permission</li>
                  <li>Copy your App ID and App Secret</li>
                  <li>Click Connect above and paste credentials</li>
                </ol>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <Heading as="h5" className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="text-red-500">🔍</span> Google Ads Setup
                </Heading>
                <ol className="mt-2 text-xs text-slate-600 space-y-1.5 list-decimal list-inside">
                  <li>Go to Google Ads API Console</li>
                  <li>Create an OAuth2 client ID</li>
                  <li>Add <code className="bg-slate-100 px-1 rounded">https://www.googleapis.com/auth/adwords</code> scope</li>
                  <li>Click Connect above and authorize</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {toast && <Toast type={toast.type} message={toast.message} onDone={() => setToast(null)} />}
    </DashboardShell>
  );
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('en-US').format(n);
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
