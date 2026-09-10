'use client';

import { useState, useEffect } from 'react';
import { Heading, Text, Button, Input, Badge } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

interface Company {
  id: string;
  name: string;
  industry?: string;
  size?: string;
  website?: string;
  address?: string;
  customers: { id: string }[];
  leads: { id: string }[];
  createdAt: string;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchCompanies();
  }, [search, page]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tenantId: TENANT_ID, page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      const res = await fetch(`${API_BASE}/companies?${params}`, { cache: 'no-store' });
      const data = await res.json();
      setCompanies(data.companies || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  };

  const deleteCompany = async (id: string) => {
    if (!confirm('Delete this company?')) return;
    await fetch(`${API_BASE}/companies/${id}?tenantId=${TENANT_ID}`, { method: 'DELETE' });
    fetchCompanies();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Heading as="h1" className="text-2xl font-bold">Companies</Heading>
        <Input
          placeholder="Search companies..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
      </div>

      {loading ? (
        <Text variant="muted">Loading...</Text>
      ) : companies.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Text variant="muted">No companies found. Add your first company to get started.</Text>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {companies.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-4">
              <div>
                <Heading as="h4" className="text-sm font-medium">{c.name}</Heading>
                <div className="flex items-center gap-2 mt-1">
                  {c.industry && <Badge variant="neutral">{c.industry}</Badge>}
                  {c.size && <Text variant="muted" className="text-xs">{c.size}</Text>}
                  <Text variant="muted" className="text-xs">
                    {c.customers?.length || 0} customers · {c.leads?.length || 0} leads
                  </Text>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <a href={`/dashboard/companies/${c.id}`}>View</a>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteCompany(c.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Text variant="muted" className="text-sm">Page {page} of {totalPages}</Text>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
