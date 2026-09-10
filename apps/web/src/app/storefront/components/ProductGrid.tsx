/**
 * ZYRA — Store Builder: ProductGrid Component
 */

import { ProductCard } from './ProductCard';

interface Product {
  id: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  images?: string[];
  slug: string;
}

interface ProductGridProps {
  products: Product[];
  title?: string;
}

export function ProductGrid({ products, title }: ProductGridProps) {
  if (!products?.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">No products available yet.</p>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      {title && (
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            name={product.name}
            price={product.price}
            compareAtPrice={product.compareAtPrice}
            image={product.images?.[0]}
            slug={product.slug}
          />
        ))}
      </div>
    </section>
  );
}
