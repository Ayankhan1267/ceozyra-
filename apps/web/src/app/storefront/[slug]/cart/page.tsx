'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import StorefrontClientShell from '../../lib/StorefrontClientShell';
import { useCart } from '../../contexts/CartContext';
import { getStorefrontBySlug, getShippingMethods } from '../../lib/api';
import Image from 'next/image';

export default function CartPage({ params }: { params: { slug: string } }) {
  const { summary, updateItem, removeItem, clear } = useCart();
  const [store, setStore] = useState<Awaited<ReturnType<typeof getStorefrontBySlug>> | null>(null);
  const [shippingMethods, setShippingMethods] = useState<Awaited<ReturnType<typeof getShippingMethods>>>([]);
  const [selectedShipping, setSelectedShipping] = useState<string | null>(null);
  const [shippingCost, setShippingCost] = useState(0);

  useEffect(() => {
    getStorefrontBySlug(params.slug).then(setStore).catch(() => {});
    getShippingMethods().then(setShippingMethods).catch(() => {});
  }, [params.slug]);

  useEffect(() => {
    if (summary?.items.length && shippingMethods.length) {
      setSelectedShipping(shippingMethods[0]?.id || null);
      setShippingCost(shippingMethods[0]?.price || 0);
    }
  }, [summary?.items.length, shippingMethods]);

  const tax = summary ? summary.subtotal * 0.08 : 0;
  const total = (summary?.subtotal || 0) + shippingCost + tax;

  if (!store) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
          <span>Loading cart...</span>
        </div>
      </div>
    );
  }

  return (
    <StorefrontClientShell store={store}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>

        {!summary?.items.length ? (
          <div className="text-center py-24">
            <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <h2 className="mt-6 text-xl font-semibold text-gray-900">Your cart is empty</h2>
            <p className="mt-2 text-gray-500">Looks like you haven&apos;t added anything to your cart yet.</p>
            <Link
              href={`/storefront/${params.slug}/products`}
              className="inline-block mt-6 rounded-xl bg-gray-900 px-8 py-3 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {summary.items.map((item) => (
                <div key={item.id} className="flex gap-4 p-4 rounded-2xl border border-gray-100 bg-white">
                  <div className="relative h-24 w-24 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <Image src={item.image} alt={item.productName} fill className="object-cover" sizes="96px" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-300">
                        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{item.productName}</h3>
                        {item.variantName && (
                          <p className="text-xs text-gray-500 mt-0.5">Variant: {item.variantName}</p>
                        )}
                        <p className="text-sm font-semibold text-gray-900 mt-1">${item.price.toFixed(2)}</p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                        aria-label="Remove item"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1 border border-gray-200 rounded-lg">
                        <button
                          onClick={() => updateItem(item.id, item.quantity - 1)}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
                          disabled={item.quantity <= 1}
                        >
                          -
                        </button>
                        <span className="px-3 py-1.5 text-sm font-medium text-gray-900 min-w-[2.5rem] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateItem(item.id, item.quantity + 1)}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        ${item.lineTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={clear}
                className="text-sm text-red-600 hover:text-red-700 transition-colors"
              >
                Clear Cart
              </button>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl border border-gray-100 bg-white p-6 lg:sticky lg:top-20">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal ({summary.itemCount} items)</span>
                    <span className="font-medium text-gray-900">${summary.subtotal.toFixed(2)}</span>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500 mb-2 block">Shipping Method</label>
                    <div className="space-y-2">
                      {shippingMethods.map((method) => (
                        <label
                          key={method.id}
                          className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                            selectedShipping === method.id
                              ? 'border-gray-900 bg-gray-50'
                              : 'border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="shipping"
                              checked={selectedShipping === method.id}
                              onChange={() => {
                                setSelectedShipping(method.id);
                                setShippingCost(method.price);
                              }}
                              className="h-4 w-4 text-gray-900"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{method.name}</p>
                              <p className="text-xs text-gray-500">{method.estimatedDays}</p>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">${method.price.toFixed(2)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Estimated Tax</span>
                    <span className="font-medium text-gray-900">${tax.toFixed(2)}</span>
                  </div>

                  <div className="border-t border-gray-100 pt-3 flex justify-between">
                    <span className="text-base font-semibold text-gray-900">Total</span>
                    <span className="text-base font-bold text-gray-900">${total.toFixed(2)}</span>
                  </div>
                </div>

                <Link
                  href={`/storefront/${params.slug}/checkout`}
                  className="block w-full mt-6 rounded-xl bg-gray-900 py-3.5 text-center text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
                >
                  Proceed to Checkout
                </Link>
                <Link
                  href={`/storefront/${params.slug}/products`}
                  className="block w-full mt-3 text-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </StorefrontClientShell>
  );
}
