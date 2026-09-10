'use client';

import { useState, useEffect, use } from 'react';
import StorefrontClientShell from '../../../lib/StorefrontClientShell';
import { useCart } from '../../../contexts/CartContext';
import { getProduct, getStorefrontBySlug, Product } from '../../../lib/api';
import { Store } from '../../../lib/store-data';
import Image from 'next/image';

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = use(params);
  const [store, setStore] = useState<Awaited<ReturnType<typeof getStorefrontBySlug>> | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);
  const [selectedVariant, setSelectedVariant] = useState<{ id: string; name: string; sku?: string; price: number } | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const { addItem, setIsOpen } = useCart();

  useEffect(() => {
    const load = async () => {
      try {
        const [storeData, productData] = await Promise.all([
          getStorefrontBySlug(slug),
          getProduct(id),
        ]);
        setStore(storeData);
        setProduct(productData);

        // Load related products
        if (productData.categoryId) {
          try {
            const { getProducts } = await import('../../../lib/api');
            const related = await getProducts({ storefrontId: storeData.id, limit: 4, categoryId: productData.categoryId });
            setRelatedProducts(related.products.filter((p: Product) => p.id !== id));
          } catch {
            // ignore
          }
        }
      } catch {
        setProduct(null);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [slug, id]);

  const handleAddToCart = async () => {
    if (!product) return;
    setAddingToCart(true);
    try {
      await addItem(product.id, quantity, selectedVariantId);
      setAddedFeedback(true);
      setTimeout(() => setAddedFeedback(false), 2000);
      setIsOpen(true);
    } catch {
      alert('Failed to add item to cart. Please try again.');
    } finally {
      setAddingToCart(false);
    }
  };

  if (isLoading) {
    return (
      <StorefrontClientShell store={{ id: '', slug, name: '', isActive: true, tenant: { name: 'Store' } } as unknown as Store}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            <span>Loading product...</span>
          </div>
        </div>
      </StorefrontClientShell>
    );
  }

  if (!product || !store) {
    return (
      <StorefrontClientShell store={{ id: '', slug, name: 'Store', isActive: true, tenant: { name: 'Store' } } as unknown as Store}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
          <h1 className="text-4xl font-bold text-gray-900">Product not found</h1>
          <p className="mt-4 text-gray-500">The product you&apos;re looking for doesn&apos;t exist.</p>
          <a href={`/storefront/${slug}/products`} className="inline-block mt-6 text-indigo-600 hover:text-indigo-700">
            &larr; Back to Products
          </a>
        </div>
      </StorefrontClientShell>
    );
  }

  const images = product.images?.length ? product.images : ['/placeholder-product.png'];
  const displayPrice = selectedVariant?.price ?? product.price;
  const hasVariants = product.variants && product.variants.length > 0;

  return (
    <StorefrontClientShell store={store}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <a href={`/storefront/${slug}`} className="hover:text-gray-900 transition-colors">Home</a>
          <span>/</span>
          <a href={`/storefront/${slug}/products`} className="hover:text-gray-900 transition-colors">Products</a>
          {product.category && (
            <>
              <span>/</span>
              <a
                href={`/storefront/${slug}/products?category=${product.categoryId}`}
                className="hover:text-gray-900 transition-colors"
              >
                {product.category}
              </a>
            </>
          )}
          <span>/</span>
          <span className="text-gray-900 font-medium line-clamp-1">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <div>
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100">
              {images[activeImageIndex] ? (
                <Image
                  src={images[activeImageIndex]}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-300">
                  <svg className="h-24 w-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              {product.compareAtPrice && (
                <span className="absolute left-4 top-4 rounded-full bg-red-500 px-3 py-1 text-sm font-bold text-white">
                  -{Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)}%
                </span>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-3 mt-4">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative h-16 w-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      activeImageIndex === idx ? 'border-gray-900' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <Image src={img} alt={`${product.name} ${idx + 1}`} fill className="object-cover" sizes="64px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            {product.category && (
              <span className="inline-block text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mb-3">
                {product.category}
              </span>
            )}
            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>

            <div className="flex items-center gap-4 mt-4">
              <span className="text-3xl font-bold text-gray-900">${displayPrice.toFixed(2)}</span>
              {product.compareAtPrice && (
                <span className="text-xl text-gray-400 line-through">
                  ${product.compareAtPrice.toFixed(2)}
                </span>
              )}
            </div>

            {product.description && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
              </div>
            )}

            {/* Variant Selector */}
            {hasVariants && (
              <div className="mt-8">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Options</h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants!.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => {
                        setSelectedVariantId(variant.id);
                        setSelectedVariant(variant);
                      }}
                      className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-colors ${
                        selectedVariantId === variant.id
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {variant.name}
                      {variant.sku && <span className="ml-1 text-xs opacity-60">{variant.sku}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity + Add to Cart */}
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Quantity</label>
                <div className="flex items-center gap-1 border border-gray-200 rounded-xl">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-40"
                    disabled={quantity <= 1}
                  >
                    -
                  </button>
                  <span className="px-4 py-2 text-sm font-semibold text-gray-900 min-w-[3rem] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={addingToCart}
                className={`w-full rounded-xl py-4 text-lg font-semibold transition-colors ${
                  addedFeedback
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                } disabled:opacity-60`}
              >
                {addingToCart ? 'Adding...' : addedFeedback ? 'Added to Cart!' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">You May Also Like</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((rp) => (
                <a
                  key={rp.id}
                  href={`/storefront/${slug}/products/${rp.id}`}
                  className="group rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md block overflow-hidden"
                >
                  <div className="relative aspect-square overflow-hidden bg-gray-100">
                    {rp.images?.[0] ? (
                      <Image
                        src={rp.images[0]}
                        alt={rp.name}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-300">
                        <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{rp.name}</h3>
                    <p className="mt-2 text-lg font-semibold text-gray-900">${rp.price.toFixed(2)}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </StorefrontClientShell>
  );
}
