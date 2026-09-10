'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import StorefrontClientShell from '../../lib/StorefrontClientShell';
import { getStorefrontBySlug, getProducts, getCategories, Product } from '../../lib/api';
import Image from 'next/image';
import { Store } from '../../lib/store-data';

function ProductsPageInner({ storefrontSlug }: { storefrontSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryFilter = searchParams.get('category') || '';
  const searchQuery = searchParams.get('search') || '';

  const [store, setStore] = useState<Awaited<ReturnType<typeof getStorefrontBySlug>> | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof getCategories>>>([]);
  const [sort, setSort] = useState<'price_asc' | 'price_desc' | 'newest' | 'name_asc'>('newest');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  const limit = 12;

  useEffect(() => {
    const loadStorefront = async () => {
      try {
        const data = await getStorefrontBySlug(storefrontSlug);
        setStore(data);
        const cats = await getCategories(data.id);
        setCategories(cats);
      } catch {
        // ignore
      }
    };
    loadStorefront();
  }, [storefrontSlug]);

  useEffect(() => {
    const loadProducts = async () => {
      if (!store) return;
      setIsLoading(true);
      try {
        const result = await getProducts({
          storefrontId: store.id,
          page,
          limit,
          categoryId: categoryFilter || undefined,
          search: searchQuery || undefined,
          sort,
        });
        setProducts(result.products);
        setTotalPages(result.totalPages);
      } catch {
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadProducts();
  }, [store?.id, page, limit, categoryFilter, searchQuery, sort]);

  useEffect(() => { setPage(1); }, [categoryFilter, searchQuery, sort]);

  const currentCategory = categories.find((c) => c.id === categoryFilter);

  if (!store) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
          <span>Loading store...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <a href={`/storefront/${storefrontSlug}`} className="hover:text-gray-900 transition-colors">Home</a>
        <span>/</span>
        <span className="text-gray-900 font-medium">
          {currentCategory ? currentCategory.name : 'Products'}
        </span>
        {searchQuery && (
          <>
            <span>/</span>
            <span className="text-gray-900 font-medium">Search: &quot;{searchQuery}&quot;</span>
          </>
        )}
      </nav>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <div className="lg:sticky lg:top-20 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Search</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const q = fd.get('q') as string;
                  const params = new URLSearchParams(searchParams.toString());
                  if (q) { params.set('search', q); } else { params.delete('search'); }
                  params.delete('category');
                  router.push(`/storefront/${storefrontSlug}/products?${params.toString()}`);
                }}
              >
                <div className="relative">
                  <input
                    type="text"
                    name="q"
                    defaultValue={searchQuery}
                    placeholder="Search products..."
                    className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Categories</h3>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete('category');
                    router.push(`/storefront/${storefrontSlug}/products?${params.toString()}`);
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    !categoryFilter ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  All Products
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set('category', cat.id);
                      router.push(`/storefront/${storefrontSlug}/products?${params.toString()}`);
                    }}
                    className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      categoryFilter === cat.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span>{cat.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Sort By</h3>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name_asc">Name: A-Z</option>
              </select>
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-gray-500">
              Showing {products.length} of {page * limit > 12 ? '...' : ''} products
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-24">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">No products found</h3>
              <p className="mt-2 text-gray-500">
                {categoryFilter || searchQuery
                  ? 'Try adjusting your filters or search terms.'
                  : 'This store has no products yet.'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {products.map((product) => {
                  const discount = product.compareAtPrice
                    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
                    : null;
                  return (
                    <a
                      key={product.id}
                      href={`/storefront/${storefrontSlug}/products/${product.id}`}
                      className="group rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md block overflow-hidden"
                    >
                      <div className="relative aspect-square overflow-hidden bg-gray-100">
                        {product.images?.[0] ? (
                          <Image
                            src={product.images[0]}
                            alt={product.name}
                            fill
                            className="object-cover transition-transform group-hover:scale-105"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-gray-300">
                            <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        {discount && (
                          <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
                            -{discount}%
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        {product.category && (
                          <span className="inline-block text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mb-2">
                            {product.category}
                          </span>
                        )}
                        <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{product.name}</h3>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-lg font-semibold text-gray-900">
                            ${product.price.toFixed(2)}
                          </span>
                          {product.compareAtPrice && (
                            <span className="text-sm text-gray-400 line-through">
                              ${product.compareAtPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-12">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StorefrontProductsPage({ params }: { params: { slug: string } }) {
  return (
    <StorefrontClientShell store={{ id: '', slug: params.slug, name: '', isActive: true, tenant: { name: 'Store' } } as unknown as Store}>
      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
              <span>Loading products...</span>
            </div>
          </div>
        }
      >
        <ProductsPageInner storefrontSlug={params.slug} />
      </Suspense>
    </StorefrontClientShell>
  );
}
