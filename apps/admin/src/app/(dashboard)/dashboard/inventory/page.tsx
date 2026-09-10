'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Heading, Text, Badge, Button, Card, Input } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';
const TENANT_ID = 'cmtsybniv005krtzxn2up82q4';

// ─── Types ─────────────────────────────────────────────────────────────────────

type InventoryItem = {
  id: string;
  productId: string;
  product: { id: string; name: string; slug: string; images: string[] };
  variant: { id: string; name: string } | null;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  location: string | null;
  updatedAt: string;
};

type StockMovement = {
  id: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  reason: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
};

type LowStockAlert = {
  id: string;
  product: { id: string; name: string; images: string[] };
  inventoryItem: { id: string; quantity: number };
  currentQuantity: number;
  threshold: number;
  status: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

type Supplier = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  contactPerson: string | null;
  paymentTerms: string | null;
  isActive: boolean;
};

type PurchaseOrder = {
  id: string;
  supplier: { id: string; name: string };
  items: any[];
  totalAmount: number;
  status: string;
  expectedDelivery: string | null;
  notes: string | null;
  createdAt: string;
};

type Stats = {
  totalItems: number;
  lowStockAlerts: number;
  totalStockUnits: number;
  pendingPurchaseOrders: number;
  activeSuppliers: number;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const MOVEMENT_TYPES = [
  { value: 'PURCHASE', label: 'Purchase', color: 'success' as const },
  { value: 'SALE', label: 'Sale', color: 'info' as const },
  { value: 'ADJUSTMENT', label: 'Adjustment', color: 'warning' as const },
  { value: 'RETURN', label: 'Return', color: 'neutral' as const },
  { value: 'TRANSFER', label: 'Transfer', color: 'info' as const },
];

const PO_STATUSES = ['DRAFT', 'ORDERED', 'SHIPPED', 'RECEIVED', 'CANCELLED'] as const;
const PO_STATUS_COLORS: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  ORDERED: 'info',
  SHIPPED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'danger',
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'items' | 'alerts' | 'suppliers' | 'purchase-orders'>('items');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inventory items
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [itemSearch, setItemSearch] = useState('');

  // Alerts
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);

  // Suppliers
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '', email: '', phone: '', address: '', city: '', country: '', contactPerson: '', paymentTerms: '',
  });

  // Purchase Orders
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poForm, setPoForm] = useState({
    supplierId: '',
    items: [{ productId: '', quantity: 1, unitCost: 0 }],
    expectedDelivery: '',
    notes: '',
  });

  // Stock adjustment
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'PURCHASE', quantity: 0, reason: '', notes: '' });

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Fetch data ──────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/stats?tenantId=${TENANT_ID}`);
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/inventory?tenantId=${TENANT_ID}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {
      setError('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/alerts?tenantId=${TENANT_ID}`);
      if (res.ok) setAlerts(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/suppliers?tenantId=${TENANT_ID}`);
      if (res.ok) setSuppliers(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchPurchaseOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/purchase-orders?tenantId=${TENANT_ID}`);
      if (res.ok) setPurchaseOrders(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (activeTab === 'items') { fetchItems(); fetchStats(); }
    if (activeTab === 'alerts') fetchAlerts();
    if (activeTab === 'suppliers') fetchSuppliers();
    if (activeTab === 'purchase-orders') { fetchSuppliers(); fetchPurchaseOrders(); }
  }, [activeTab, fetchItems, fetchStats, fetchAlerts, fetchSuppliers, fetchPurchaseOrders]);

  // ─── Stock Adjustment ────────────────────────────────────────────────────────

  const openAdjust = (item: InventoryItem) => {
    setAdjustingItem(item);
    setAdjustForm({ type: 'PURCHASE', quantity: 0, reason: '', notes: '' });
    setAdjustModalOpen(true);
  };

  const handleAdjust = async () => {
    if (!adjustingItem || adjustForm.quantity === 0) return;
    try {
      const res = await fetch(`${API_BASE}/api/inventory/${adjustingItem.id}/adjust?tenantId=${TENANT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustForm),
      });
      if (!res.ok) throw new Error('Adjustment failed');
      showToast('success', 'Stock adjusted successfully');
      setAdjustModalOpen(false);
      fetchItems();
      fetchStats();
    } catch {
      showToast('error', 'Failed to adjust stock');
    }
  };

  // ─── Alerts ──────────────────────────────────────────────────────────────────

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/alerts/${alertId}/acknowledge?tenantId=${TENANT_ID}`, {
        method: 'POST',
      });
      if (res.ok) { showToast('success', 'Alert acknowledged'); fetchAlerts(); }
    } catch { showToast('error', 'Failed'); }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/alerts/${alertId}/resolve?tenantId=${TENANT_ID}`, {
        method: 'POST',
      });
      if (res.ok) { showToast('success', 'Alert resolved'); fetchAlerts(); fetchStats(); }
    } catch { showToast('error', 'Failed'); }
  };

  // ─── Suppliers ───────────────────────────────────────────────────────────────

  const openCreateSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({ name: '', email: '', phone: '', address: '', city: '', country: '', contactPerson: '', paymentTerms: '' });
    setSupplierModalOpen(true);
  };

  const openEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setSupplierForm({
      name: s.name, email: s.email || '', phone: s.phone || '', address: s.address || '',
      city: s.city || '', country: s.country || '', contactPerson: s.contactPerson || '', paymentTerms: s.paymentTerms || '',
    });
    setSupplierModalOpen(true);
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.name) return;
    try {
      const url = editingSupplier
        ? `${API_BASE}/api/inventory/suppliers/${editingSupplier.id}?tenantId=${TENANT_ID}`
        : `${API_BASE}/api/inventory/suppliers?tenantId=${TENANT_ID}`;
      const method = editingSupplier ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierForm),
      });
      if (!res.ok) throw new Error('Failed');
      showToast('success', editingSupplier ? 'Supplier updated' : 'Supplier created');
      setSupplierModalOpen(false);
      fetchSuppliers();
    } catch {
      showToast('error', 'Failed to save supplier');
    }
  };

  const deleteSupplier = async (id: string) => {
    if (!confirm('Delete this supplier?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/inventory/suppliers/${id}?tenantId=${TENANT_ID}`, { method: 'DELETE' });
      if (res.ok) { showToast('success', 'Supplier deleted'); fetchSuppliers(); }
    } catch { showToast('error', 'Failed'); }
  };

  // ─── Purchase Orders ─────────────────────────────────────────────────────────

  const handleCreatePO = async () => {
    if (!poForm.supplierId || poForm.items.length === 0) return;
    try {
      const res = await fetch(`${API_BASE}/api/inventory/purchase-orders?tenantId=${TENANT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(poForm),
      });
      if (!res.ok) throw new Error('Failed');
      showToast('success', 'Purchase order created');
      setPoModalOpen(false);
      setPoForm({ supplierId: '', items: [{ productId: '', quantity: 1, unitCost: 0 }], expectedDelivery: '', notes: '' });
      fetchPurchaseOrders();
    } catch {
      showToast('error', 'Failed to create purchase order');
    }
  };

  const updatePOStatus = async (poId: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/purchase-orders/${poId}?tenantId=${TENANT_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        showToast('success', `PO updated to ${status}`);
        fetchPurchaseOrders();
        if (status === 'RECEIVED') { fetchItems(); fetchStats(); }
      }
    } catch {
      showToast('error', 'Failed to update PO');
    }
  };

  const deletePO = async (id: string) => {
    if (!confirm('Delete this purchase order?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/inventory/purchase-orders/${id}?tenantId=${TENANT_ID}`, { method: 'DELETE' });
      if (res.ok) { showToast('success', 'Deleted'); fetchPurchaseOrders(); }
    } catch { showToast('error', 'Failed'); }
  };

  // ─── Filtered items ──────────────────────────────────────────────────────────

  const filteredItems = itemSearch.trim()
    ? items.filter((it) => it.product?.name?.toLowerCase().includes(itemSearch.toLowerCase()))
    : items;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Heading as="h1">Inventory</Heading>
          <Text variant="muted" className="mt-1">Manage stock, suppliers, and purchase orders</Text>
        </div>
        {activeTab === 'suppliers' && (
          <Button onClick={openCreateSupplier}>+ Add Supplier</Button>
        )}
        {activeTab === 'purchase-orders' && (
          <Button onClick={() => setPoModalOpen(true)}>+ New Purchase Order</Button>
        )}
      </div>

      {/* Stats */}
      {stats && activeTab === 'items' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total SKUs', value: stats.totalItems, color: 'bg-indigo-50 text-indigo-700' },
            { label: 'Low Stock Alerts', value: stats.lowStockAlerts, color: stats.lowStockAlerts > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700' },
            { label: 'Total Units', value: stats.totalStockUnits, color: 'bg-blue-50 text-blue-700' },
            { label: 'Pending POs', value: stats.pendingPurchaseOrders, color: stats.pendingPurchaseOrders > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-700' },
            { label: 'Suppliers', value: stats.activeSuppliers, color: 'bg-purple-50 text-purple-700' },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <Text variant="muted">{s.label}</Text>
              <p className={`text-2xl font-bold mt-1 rounded-lg px-2 py-1 inline-block ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {[
          { key: 'items', label: 'Stock', count: items.length },
          { key: 'alerts', label: 'Alerts', count: alerts.length },
          { key: 'suppliers', label: 'Suppliers', count: suppliers.length },
          { key: 'purchase-orders', label: 'Purchase Orders', count: purchaseOrders.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <Card className="p-4 mb-6 border-red-200 bg-red-50">
          <Text className="text-red-700">{error}</Text>
        </Card>
      )}

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* ─── INVENTORY ITEMS TAB ──────────────────────────────────────────────── */}
      {activeTab === 'items' && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-4">
            <Input
              placeholder="Search products..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button variant="outline" size="sm" onClick={fetchItems}>Refresh</Button>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading inventory...</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {itemSearch ? 'No products match your search' : 'No inventory items yet'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reserved</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Available</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredItems.map((item) => {
                    const isLow = item.availableQuantity <= item.lowStockThreshold;
                    return (
                      <tr key={item.id} className={isLow ? 'bg-red-50/30' : ''}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.product?.images?.[0] && (
                              <img src={item.product.images[0]} alt="" className="h-8 w-8 rounded object-cover" />
                            )}
                            <span className="font-medium text-gray-900">{item.product?.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {item.variant?.name || item.product?.slug}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{item.reservedQuantity}</td>
                        <td className="px-4 py-3 text-right font-semibold">{item.availableQuantity}</td>
                        <td className="px-4 py-3 text-center">
                          {isLow ? (
                            <Badge variant="danger">Low Stock</Badge>
                          ) : item.quantity === 0 ? (
                            <Badge variant="danger">Out of Stock</Badge>
                          ) : (
                            <Badge variant="success">In Stock</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => openAdjust(item)}>Adjust</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ─── ALERTS TAB ───────────────────────────────────────────────────────── */}
      {activeTab === 'alerts' && (
        <Card className="overflow-hidden">
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No low stock alerts. Everything looks good!</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Threshold</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {alerts.map((alert) => (
                    <tr key={alert.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {alert.product?.images?.[0] && (
                            <img src={alert.product.images[0]} alt="" className="h-8 w-8 rounded object-cover" />
                          )}
                          <span className="font-medium text-gray-900">{alert.product?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{alert.currentQuantity}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{alert.threshold}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={alert.status === 'ACTIVE' ? 'danger' : 'neutral'}>
                          {alert.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{new Date(alert.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          {alert.status === 'ACTIVE' && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => acknowledgeAlert(alert.id)}>
                                Ack
                              </Button>
                              <Button size="sm" onClick={() => resolveAlert(alert.id)}>
                                Resolve
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ─── SUPPLIERS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'suppliers' && (
        <Card className="overflow-hidden">
          {suppliers.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No suppliers yet. Add your first supplier.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Terms</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {suppliers.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{s.name}</p>
                        {s.contactPerson && <p className="text-xs text-gray-500">{s.contactPerson}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {s.email && <p>{s.email}</p>}
                        {s.phone && <p>{s.phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {s.city}{s.country ? `, ${s.country}` : ''}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{s.paymentTerms || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => openEditSupplier(s)}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => deleteSupplier(s.id)} className="text-red-600 border-red-200 hover:bg-red-50">
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ─── PURCHASE ORDERS TAB ──────────────────────────────────────────────── */}
      {activeTab === 'purchase-orders' && (
        <Card className="overflow-hidden">
          {purchaseOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No purchase orders yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expected</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {purchaseOrders.map((po) => (
                    <tr key={po.id}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{po.id.slice(-8)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{po.supplier?.name}</td>
                      <td className="px-4 py-3 text-right font-medium">${Number(po.totalAmount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={PO_STATUS_COLORS[po.status] || 'neutral'}>{po.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          {PO_STATUSES.indexOf(po.status as typeof PO_STATUSES[number]) < PO_STATUSES.length - 1 && po.status !== 'RECEIVED' && po.status !== 'CANCELLED' && (
                            <Button size="sm" variant="outline" onClick={() => {
                              const next = PO_STATUSES[PO_STATUSES.indexOf(po.status as typeof PO_STATUSES[number]) + 1];
                              updatePOStatus(po.id, next);
                            }}>
                              Advance
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => deletePO(po.id)} className="text-red-600 border-red-200 hover:bg-red-50">
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ─── ADJUST STOCK MODAL ──────────────────────────────────────────────── */}
      {adjustModalOpen && adjustingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAdjustModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Heading as="h3" className="mb-4">Adjust Stock</Heading>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Product</span>
                <span className="font-medium">{adjustingItem.product?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Current Qty</span>
                <span className="font-medium">{adjustingItem.quantity}</span>
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">Adjustment Type</label>
                <select
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {MOVEMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">Quantity (+ to add, - to remove)</label>
                <Input
                  type="number"
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">Reason</label>
                <Input
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder="e.g. Damaged goods, restock..."
                />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">Notes (optional)</label>
                <textarea
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setAdjustModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAdjust} disabled={adjustForm.quantity === 0}>Adjust Stock</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SUPPLIER MODAL ──────────────────────────────────────────────────── */}
      {supplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSupplierModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <Heading as="h3" className="mb-4">{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</Heading>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="col-span-2">
                <label className="text-sm text-gray-500 block mb-1">Name *</label>
                <Input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">Email</label>
                <Input value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">Phone</label>
                <Input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="text-sm text-gray-500 block mb-1">Address</label>
                <Input value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">City</label>
                <Input value={supplierForm.city} onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">Country</label>
                <Input value={supplierForm.country} onChange={(e) => setSupplierForm({ ...supplierForm, country: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">Contact Person</label>
                <Input value={supplierForm.contactPerson} onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">Payment Terms</label>
                <Input value={supplierForm.paymentTerms} onChange={(e) => setSupplierForm({ ...supplierForm, paymentTerms: e.target.value })} placeholder="Net 30" />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setSupplierModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveSupplier} disabled={!supplierForm.name}>Save Supplier</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PURCHASE ORDER MODAL ────────────────────────────────────────────── */}
      {poModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPoModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <Heading as="h3" className="mb-4">New Purchase Order</Heading>
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-sm text-gray-500 block mb-1">Supplier *</label>
                <select
                  value={poForm.supplierId}
                  onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select supplier</option>
                  {suppliers.filter((s) => s.isActive).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              {poForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Product ID"
                    value={item.productId}
                    onChange={(e) => {
                      const updated = [...poForm.items];
                      updated[idx] = { ...updated[idx], productId: e.target.value };
                      setPoForm({ ...poForm, items: updated });
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Qty"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => {
                      const updated = [...poForm.items];
                      updated[idx] = { ...updated[idx], quantity: Number(e.target.value) };
                      setPoForm({ ...poForm, items: updated });
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Unit Cost"
                    min={0}
                    step="0.01"
                    value={item.unitCost}
                    onChange={(e) => {
                      const updated = [...poForm.items];
                      updated[idx] = { ...updated[idx], unitCost: Number(e.target.value) };
                      setPoForm({ ...poForm, items: updated });
                    }}
                  />
                </div>
              ))}
              <div>
                <label className="text-sm text-gray-500 block mb-1">Expected Delivery</label>
                <Input
                  type="date"
                  value={poForm.expectedDelivery}
                  onChange={(e) => setPoForm({ ...poForm, expectedDelivery: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">Notes</label>
                <textarea
                  value={poForm.notes}
                  onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setPoModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreatePO} disabled={!poForm.supplierId}>Create PO</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
