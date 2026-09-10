'use client';

import { useCart } from '@/app/storefront/contexts/CartContext';
import Image from 'next/image';

export default function CartDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { cart, summary, removeItem, updateItem, isLoading } = useCart();

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40 transition-opacity" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-[70] h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Shopping Cart</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close cart"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            </div>
          ) : !summary?.items.length ? (
            <div className="text-center py-16">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              <p className="mt-4 text-gray-500">Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {summary.items.map((item) => (
                <div key={item.id} className="flex gap-4 p-3 rounded-xl bg-gray-50">
                  <div className="relative h-20 w-20 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <Image src={item.image} alt={item.productName} fill className="object-cover" sizes="80px" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-gray-300">
                        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{item.productName}</h3>
                    {item.variantName && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.variantName}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 border border-gray-200 rounded-lg">
                        <button
                          onClick={() => updateItem(item.id, item.quantity - 1)}
                          className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
                          disabled={item.quantity <= 1}
                        >
                          -
                        </button>
                        <span className="px-2 py-1 text-sm font-medium text-gray-900 min-w-[2rem] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateItem(item.id, item.quantity + 1)}
                          className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      ${item.lineTotal.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {summary?.items.length ? (
          <div className="border-t border-gray-100 p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold text-gray-900">${summary.subtotal.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400">Shipping & taxes calculated at checkout</p>
            <a
              href={`/storefront/${cart?.storefrontId || ''}/cart`}
              onClick={onClose}
              className="block w-full rounded-xl bg-gray-900 py-3 text-center text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              View Cart
            </a>
          </div>
        ) : null}
      </aside>
    </>
  );
}
