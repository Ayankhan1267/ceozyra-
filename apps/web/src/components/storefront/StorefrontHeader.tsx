'use client';

import { Store, StorePage } from '@/app/storefront/lib/store-data';
import { useCart } from '@/app/storefront/contexts/CartContext';
import Link from 'next/link';

interface Props {
  store: Store;
  onCartClick?: () => void;
}

export default function StorefrontHeader({ store, onCartClick }: Props) {
  const { itemCount } = useCart();
  const publishedPages = store.pages?.filter((p) => p.isPublished) ?? [];

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/storefront/${store.slug}`}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              {store.logo ? (
                <img src={store.logo} alt={store.name} className="h-8 w-8 rounded" />
              ) : (
                <div className="h-8 w-8 rounded bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                  {store.name?.charAt(0)?.toUpperCase() || 'S'}
                </div>
              )}
              <span className="text-lg font-semibold text-gray-900">{store.name}</span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link
              href={`/storefront/${store.slug}`}
              className="hover:text-gray-900 transition-colors"
            >
              Home
            </Link>
            <Link
              href={`/storefront/${store.slug}/products`}
              className="hover:text-gray-900 transition-colors"
            >
              Products
            </Link>
            {publishedPages.map((page) => (
              <a
                key={page.id}
                href={`#${page.slug}`}
                className="hover:text-gray-900 transition-colors"
              >
                {page.title}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={onCartClick}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Open cart"
            >
              <svg className="h-6 w-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-medium">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
