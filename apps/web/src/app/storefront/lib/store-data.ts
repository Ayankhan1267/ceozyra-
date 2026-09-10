/**
 * ZYRA — Store Builder: Storefront data fetching utilities
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface StorePage {
  id: string;
  title: string;
  slug: string;
  type: string;
  isPublished: boolean;
  sortOrder: number;
}

export interface StoreTheme {
  id: string;
  name: string;
  colors: Record<string, string>;
  fonts?: Record<string, string>;
  isActive: boolean;
}

export interface StoreProduct {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  isActive: boolean;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  theme?: Record<string, unknown>;
  domain?: string;
  isActive: boolean;
  pages?: StorePage[];
  themeData?: StoreTheme;
  products?: StoreProduct[];
  tenant: { name: string };
}

export async function getStoreBySlug(slug: string): Promise<Store> {
  const res = await fetch(`${API_BASE}/storefronts/slug/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Store "${slug}" not found`);
  return res.json();
}

export async function getStorePages(storeId: string): Promise<StorePage[]> {
  const res = await fetch(`${API_BASE}/stores/${storeId}/pages`, {
    next: { revalidate: 120 },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function getStoreProducts(storeId: string): Promise<StoreProduct[]> {
  const res = await fetch(`${API_BASE}/stores/${storeId}/products`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  return res.json();
}
