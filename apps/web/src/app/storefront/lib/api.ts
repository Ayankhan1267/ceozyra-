/**
 * ZYRA — Storefront API client
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(`${API_BASE}/api${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(buildUrl(path), {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}: ${res.statusText}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Storefront ──────────────────────────────────────────────────────────────

export async function getStorefrontBySlug(slug: string) {
  return request<{
    id: string;
    name: string;
    slug: string;
    description?: string;
    logo?: string;
    theme?: Record<string, unknown>;
    isActive: boolean;
    tenant: { name: string };
    store: {
      id: string;
      name: string;
      domain?: string;
      pages: Array<{
        id: string;
        title: string;
        slug: string;
        isPublished: boolean;
        sortOrder: number;
      }>;
    };
  }>(`/storefronts/slug/${encodeURIComponent(slug)}`);
}

// ── Products ────────────────────────────────────────────────────────────────

export interface ProductListParams {
  storefrontId: string;
  page?: number;
  limit?: number;
  categoryId?: string;
  search?: string;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'name_asc';
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  categoryId?: string;
  category?: string;
  isActive: boolean;
  variants?: ProductVariant[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  price: number;
  inventory: number;
  attributes?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export async function getProducts(params: ProductListParams): Promise<ProductListResponse> {
  const { storefrontId, page = 1, limit = 20, categoryId, search, sort } = params;

  let orderBy: 'createdAt' | 'price' | 'name' = 'createdAt';
  let orderDirection: 'asc' | 'desc' = 'desc';

  switch (sort) {
    case 'price_asc':
      orderBy = 'price';
      orderDirection = 'asc';
      break;
    case 'price_desc':
      orderBy = 'price';
      orderDirection = 'desc';
      break;
    case 'newest':
      orderBy = 'createdAt';
      orderDirection = 'desc';
      break;
    case 'name_asc':
      orderBy = 'name';
      orderDirection = 'asc';
      break;
  }

  const response = await request<{
    products: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`/products/storefront/${storefrontId}`, {
    method: 'GET',
    next: { revalidate: 60 },
    // We'll handle pagination on the client side for sorting
  });

  // Client-side filtering and sorting
  let products = [...(response.products || [])];

  if (search) {
    const q = search.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
    );
  }

  if (categoryId) {
    products = products.filter((p) => p.categoryId === categoryId);
  }

  // Sort
  products.sort((a, b) => {
    switch (sort) {
      case 'price_asc':
        return a.price - b.price;
      case 'price_desc':
        return b.price - a.price;
      case 'name_asc':
        return a.name.localeCompare(b.name);
      case 'newest':
      default:
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    }
  });

  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const paginatedProducts = products.slice(start, start + limit);

  return {
    products: paginatedProducts,
    total,
    page,
    limit,
    totalPages,
  };
}

export async function getProduct(id: string): Promise<Product> {
  return request<Product>(`/products/${id}`);
}

// ── Categories ──────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  storefrontId: string;
  sortOrder?: number;
  _count?: { products: number };
}

export async function getCategories(storefrontId: string): Promise<Category[]> {
  const res = await request<Category[]>(`/categories?storefrontId=${storefrontId}`);
  return res || [];
}

// ── Collections ─────────────────────────────────────────────────────────────

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  featured: boolean;
  sortOrder: number;
  storefrontId: string;
  products?: Product[];
}

export async function getCollections(storefrontId: string): Promise<Collection[]> {
  const res = await request<Collection[]>(`/collections?storefrontId=${storefrontId}`);
  return res || [];
}

// ── Cart ────────────────────────────────────────────────────────────────────

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  product: {
    id: string;
    name: string;
    images: string[];
    price: number;
    variants: ProductVariant[];
  };
  variant?: {
    id: string;
    name: string;
    price: number;
  };
}

export interface Cart {
  id: string;
  tenantId: string;
  storefrontId: string;
  customerId?: string;
  sessionId?: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CartSummary {
  id: string;
  tenantId: string;
  storefrontId: string;
  customerId?: string;
  sessionId?: string;
  items: Array<{
    id: string;
    productId: string;
    variantId?: string;
    variantName?: string;
    productName: string;
    image?: string;
    price: number;
    quantity: number;
    lineTotal: number;
  }>;
  subtotal: number;
  itemCount: number;
}

export async function getCart(tenantId: string, customerId: string): Promise<Cart | null> {
  try {
    return await request<Cart>(`/carts/customer/${customerId}`);
  } catch {
    return null;
  }
}

export async function getCartBySession(sessionId: string): Promise<Cart | null> {
  try {
    return await request<Cart>(`/carts/session/${sessionId}`);
  } catch {
    return null;
  }
}

export async function createCart(tenantId: string, storefrontId: string, customerId?: string, sessionId?: string): Promise<Cart> {
  return request<Cart>('/carts', {
    method: 'POST',
    body: JSON.stringify({ tenantId, storefrontId, customerId, sessionId }),
  });
}

export async function addCartItem(cartId: string, productId: string, quantity: number, variantId?: string): Promise<Cart> {
  return request<Cart>(`/carts/${cartId}/items`, {
    method: 'POST',
    body: JSON.stringify({ productId, quantity, variantId }),
  });
}

export async function updateCartItem(cartId: string, itemId: string, quantity: number): Promise<Cart> {
  return request<Cart>(`/carts/${cartId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });
}

export async function removeCartItem(cartId: string, itemId: string): Promise<Cart> {
  return request<Cart>(`/carts/${cartId}/items/${itemId}`, {
    method: 'DELETE',
  });
}

export async function clearCart(cartId: string): Promise<Cart> {
  return request<Cart>(`/carts/${cartId}/clear`, {
    method: 'DELETE',
  });
}

// ── Checkout ────────────────────────────────────────────────────────────────

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  description?: string;
  price: number;
  estimatedDays: string;
}

export interface CheckoutResult {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    subtotal: number;
    tax: number;
    shipping: number;
    createdAt: string;
    items: Array<{
      id: string;
      productId: string;
      variantId?: string;
      name: string;
      unitPrice: number;
      quantity: number;
      total: number;
    }>;
  };
  message?: string;
}

export async function getShippingMethods(): Promise<ShippingMethod[]> {
  try {
    return await request<ShippingMethod[]>('/checkout/shipping-methods');
  } catch {
    return [
      { id: 'standard', name: 'Standard Shipping', price: 5.99, estimatedDays: '5-7 business days' },
      { id: 'express', name: 'Express Shipping', price: 12.99, estimatedDays: '2-3 business days' },
      { id: 'overnight', name: 'Overnight Shipping', price: 24.99, estimatedDays: '1 business day' },
    ];
  }
}

export async function validateCart(cartId: string): Promise<{ valid: boolean; errors?: string[] }> {
  try {
    return await request<{ valid: boolean; errors?: string[] }>('/checkout/validate', {
      method: 'POST',
      body: JSON.stringify({ cartId }),
    });
  } catch {
    return { valid: true };
  }
}

export async function createOrder(cartId: string, shippingAddress: ShippingAddress, shippingMethodId: string): Promise<CheckoutResult> {
  return request<CheckoutResult>('/checkout', {
    method: 'POST',
    body: JSON.stringify({
      cartId,
      shippingAddress,
      shippingMethodId,
    }),
  });
}
