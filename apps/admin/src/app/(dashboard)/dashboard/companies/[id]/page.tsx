'use client';

import { useState, useEffect } from 'react';
import { Heading, Text, Button, Badge } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

interface CompanyDetail {
  id: string;
  name: string;
  industry?: string;
  size?: string;
  website?: string;
  address?: string;
  customers: { id: string; firstName: string; lastName: string; email: string }[];
  leads: { id: string; firstName: string; lastName: string; email: string; status: string }[];
  createdAt: string;
}

export default function CompanyDetailPage({ params }: { params: { id: string } }) {
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompany();
  }, [params.id]);

  const fetchCompany = async () => {
    try {
      const res = await fetch(`${API_BASE}/companies/${params.id}?tenantId=${TENANT_ID}`, { cache: 'no-store' });
      if (res.ok) setCompany(await res.json());
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6"><Text variant="muted">Loading...</Text></div>;
  if (!company) return <div className="p-6"><Text variant="muted">Company not found</Text></div>;

  return (
    <div className="space-y-6">
      <Heading as="h1" className="text-2xl font-bold">{company.name}</Heading>
      <Text variant="muted">{company.industry || 'No industry'} · {company.customers?.length || 0} customers</Text>

      <div className="grid grid-cols-3 gap-4">
        {company.industry && (
          <div className="rounded-lg border p-4">
            <Text variant="muted" className="text-xs">Industry</Text>
            <p className="mt-1 font-medium">{company.industry}</p>
          </div>
        )}
        {company.size && (
          <div className="rounded-lg border p-4">
            <Text variant="muted" className="text-xs">Size</Text>
            <p className="mt-1 font-medium">{company.size}</p>
          </div>
        )}
        <div className="rounded-lg border p-4">
          <Text variant="muted" className="text-xs">Total Customers</Text>
          <p className="mt-1 font-medium">{company.customers?.length || 0}</p>
        </div>
      </div>

      {company.website && (
        <div>
          <Text variant="muted" className="text-xs">Website</Text>
          <a href={company.website} target="_blank" rel="noopener" className="block mt-1 text-blue-600 hover:underline">{company.website}</a>
        </div>
      )}

      <div>
        <Heading as="h3" className="text-lg font-semibold mb-3">Customers ({company.customers?.length || 0})</Heading>
        {company.customers?.length > 0 ? (
          <div className="rounded-lg border divide-y">
            {company.customers.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">{c.firstName} {c.lastName}</p>
                  <Text variant="muted" className="text-xs">{c.email}</Text>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <a href={`/dashboard/customers/${c.id}`}>View</a>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Text variant="muted">No customers associated.</Text>
        )}
      </div>

      <div>
        <Heading as="h3" className="text-lg font-semibold mb-3">Leads ({company.leads?.length || 0})</Heading>
        {company.leads?.length > 0 ? (
          <div className="rounded-lg border divide-y">
            {company.leads.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">{l.firstName} {l.lastName}</p>
                  <Text variant="muted" className="text-xs">{l.email}</Text>
                </div>
                <Badge variant={l.status === 'WON' ? 'success' : 'neutral'}>{l.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <Text variant="muted">No leads associated.</Text>
        )}
      </div>
    </div>
  );
}
