'use client';

import { useState, useEffect } from 'react';
import { Heading, Text, Button, Input, Badge, Sheet } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

interface Tag {
  id: string;
  name: string;
  color?: string;
  customerCount?: number;
  _count?: { customers: number };
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const res = await fetch(`${API_BASE}/tags?tenantId=${TENANT_ID}`, { cache: 'no-store' });
      const data = await res.json();
      setTags(data.tags || []);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!name.trim()) return;
    if (editing) {
      await fetch(`${API_BASE}/tags/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID, name, color }),
      });
    } else {
      await fetch(`${API_BASE}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID, name, color }),
      });
    }
    setName('');
    setEditing(null);
    setColor(COLORS[0]);
    setOpen(false);
    fetchTags();
  };

  const deleteTag = async (id: string) => {
    if (!confirm('Delete this tag?')) return;
    await fetch(`${API_BASE}/tags/${id}?tenantId=${TENANT_ID}`, { method: 'DELETE' });
    fetchTags();
  };

  const openSheet = (tag?: Tag) => {
    if (tag) { setEditing(tag); setName(tag.name); setColor(tag.color || COLORS[0]); }
    else { setEditing(null); setName(''); setColor(COLORS[0]); }
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Heading as="h1" className="text-2xl font-bold flex-1">Tags</Heading>
        <Sheet open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Tag' : 'Create Tag'}>
          <div className="space-y-4 mt-6">
            <div>
              <Text className="text-sm font-medium mb-1">Name</Text>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tag name" />
            </div>
            <div>
              <Text className="text-sm font-medium mb-2">Color</Text>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 transition ${color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={save}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </Sheet>
      </div>

      {loading ? (
        <Text variant="muted">Loading...</Text>
      ) : tags.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Text variant="muted">No tags yet. Create your first tag to organize contacts.</Text>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tags.map((tag) => (
            <div key={tag.id} className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                <Heading as="h4" className="text-sm font-medium">{tag.name}</Heading>
              </div>
              <Text variant="muted" className="text-xs">
                {tag.customerCount ?? tag._count?.customers ?? 0} customers
              </Text>
              <div className="flex gap-2 mt-3">
                <Button variant="ghost" size="sm" onClick={() => openSheet(tag)}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => deleteTag(tag.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
