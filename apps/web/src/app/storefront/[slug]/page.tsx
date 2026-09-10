import { Metadata } from 'next';
import StorefrontClientShell from '../lib/StorefrontClientShell';
import { getStorefrontBySlug, getProducts, getCategories, getCollections } from '../lib/api';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const storefront = await getStorefrontBySlug(params.slug);
    return {
      title: storefront.name || 'Store',
      description: storefront.description || 'Welcome to our store',
    };
  } catch {
    return { title: 'Store' };
  }
}

export default async function StorefrontHomePage({ params }: Props) {
  let storefront = null;
  let products: Awaited<ReturnType<typeof getProducts>>['products'] = [];
  let categories: Awaited<ReturnType<typeof getCategories>> = [];
  let collections: Awaited<ReturnType<typeof getCollections>> = [];
  let error: string | null = null;

  try {
    storefront = await getStorefrontBySlug(params.slug);
    if (!storefront) throw new Error('Storefront not found');

    const [productsResult, categoriesResult, collectionsResult] = await Promise.all([
      getProducts({ storefrontId: storefront.id, limit: 8, sort: 'newest' }),
      getCategories(storefront.id),
      getCollections(storefront.id),
    ]);
    products = productsResult.products;
    categories = categoriesResult;
    collections = collectionsResult.filter((c) => c.featured);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load storefront';
  }

  if (error || !storefront) {
    return (
      <StorefrontClientShell store={storefront || ({ id: '', slug: params.slug, name: '', pages: [] } as any)}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <h1 className="text-4xl font-bold text-gray-900">Store not found</h1>
          <p className="mt-4 text-gray-500">The storefront &quot;{params.slug}&quot; could not be found.</p>
        </div>
      </StorefrontClientShell>
    );
  }

  return (
    <StorefrontClientShell store={storefront}>
      {/* Hero */}
      <section className="relative bg-gray-900 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{storefront.name}</h1>
          {storefront.description && (
            <p className="mt-4 text-lg text-gray-300 max-w-2xl">{storefront.description}</p>
          )}
          <a
            href={`/storefront/${storefront.slug}/products`}
            className="inline-block mt-8 rounded-xl bg-white px-8 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Shop Now
          </a>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Shop by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories.map((cat) => (
              <a
                key={cat.id}
                href={`/storefront/${storefront.slug}/products?category=${cat.id}`}
                className="group rounded-2xl border border-gray-100 bg-white p-4 text-center hover:shadow-md transition-shadow"
              >
                <div className="h-16 w-16 mx-auto rounded-full bg-gray-50 flex items-center justify-center mb-3 group-hover:bg-gray-100 transition-colors">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-900">{cat.name}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Featured Collections */}
      {collections.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 bg-gray-50">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Collections</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <a
                key={collection.id}
                href={`/storefront/${storefront.slug}/products?collection=${collection.id}`}
                className="group relative aspect-[16/9] rounded-2xl overflow-hidden bg-gray-200"
              >
                {collection.image ? (
                  <img
                    src={collection.image}
                    alt={collection.name}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-300">{collection.name}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h3 className="text-xl font-bold text-white">{collection.name}</h3>
                  {collection.description && (
                    <p className="text-sm text-gray-200 mt-1 line-clamp-2">{collection.description}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {products.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
            <a
              href={`/storefront/${storefront.slug}/products`}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              View All &rarr;
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <a
                key={product.id}
                href={`/storefront/${storefront.slug}/products/${product.id}`}
                className="group rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md block overflow-hidden"
              >
                <div className="relative aspect-square overflow-hidden bg-gray-100">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-300">
                      <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {product.compareAtPrice && (
                    <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
                      -{Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)}%
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{product.name}</h3>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-lg font-semibold text-gray-900">${product.price.toFixed(2)}</span>
                    {product.compareAtPrice && (
                      <span className="text-sm text-gray-400 line-through">
                        ${product.compareAtPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {products.length === 0 && categories.length === 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No products yet</h3>
            <p className="mt-2 text-gray-500">This store doesn&apos;t have any products available at the moment.</p>
          </div>
        </section>
      )}
    </StorefrontClientShell>
  );
}
