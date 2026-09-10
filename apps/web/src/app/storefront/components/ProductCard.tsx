/**
 * ZYRA — Store Builder: ProductCard Component
 */

import Image from 'next/image';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  image?: string;
  slug: string;
}

export function ProductCard({ id: _id, name, price, compareAtPrice, image, slug: _slug }: ProductCardProps) {
  const discount = compareAtPrice ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : null;

  return (
    <div className="group relative rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-gray-100">
        {image ? (
          <Image
            src={image}
            alt={name}
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
        {discount && (
          <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
            -{discount}%
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{name}</h3>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-900">
            ${price.toFixed(2)}
          </span>
          {compareAtPrice && (
            <span className="text-sm text-gray-400 line-through">
              ${compareAtPrice.toFixed(2)}
            </span>
          )}
        </div>
        <button
          className="mt-3 w-full rounded-lg bg-gray-900 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          onClick={() => {}}
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}
