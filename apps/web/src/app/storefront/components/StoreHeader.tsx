/**
 * ZYRA — Store Builder: Next.js Storefront Components
 */

import { Store } from '../lib/store-data';

export function StoreHeader({ store }: { store: Store }) {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            {store.logo && (
              <img src={store.logo} alt={store.name} className="h-8 w-8 rounded" />
            )}
            <span className="text-lg font-semibold text-gray-900">{store.name}</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            {store.pages?.filter((p) => p.isPublished).map((page) => (
              <a
                key={page.id}
                href={`#${page.slug}`}
                className="hover:text-gray-900 transition-colors"
              >
                {page.title}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
