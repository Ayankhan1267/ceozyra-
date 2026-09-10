'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import StorefrontClientShell from '../../lib/StorefrontClientShell';
import { useCart } from '../../contexts/CartContext';
import { getStorefrontBySlug, getShippingMethods, ShippingAddress, ShippingMethod, validateCart, createOrder } from '../../lib/api';
import Image from 'next/image';

export default function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { cart, summary } = useCart();
  const [store, setStore] = useState<Awaited<ReturnType<typeof getStorefrontBySlug>> | null>(null);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<string | null>(null);
  const [shippingCost, setShippingCost] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<Awaited<ReturnType<typeof createOrder>> | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const [form, setForm] = useState<ShippingAddress>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
  });

  useEffect(() => {
    getStorefrontBySlug(slug).then(setStore).catch(() => {});
    getShippingMethods().then((methods) => {
      setShippingMethods(methods);
      if (methods.length) {
        setSelectedShipping(methods[0].id);
        setShippingCost(methods[0].price);
      }
    }).catch(() => {});
  }, [slug]);

  const updateField = (field: keyof ShippingAddress, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => prev.filter((e) => !e.includes(field)));
  };

  const tax = (summary?.subtotal || 0) * 0.08;
  const total = (summary?.subtotal || 0) + shippingCost + tax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    if (!cart) {
      setErrors(['Your cart is empty.']);
      return;
    }

    // Validate form
    const newErrors: string[] = [];
    if (!form.firstName) newErrors.push('First name is required');
    if (!form.lastName) newErrors.push('Last name is required');
    if (!form.email) newErrors.push('Email is required');
    if (!form.phone) newErrors.push('Phone is required');
    if (!form.addressLine1) newErrors.push('Address is required');
    if (!form.city) newErrors.push('City is required');
    if (!form.state) newErrors.push('State is required');
    if (!form.zipCode) newErrors.push('ZIP code is required');
    if (!form.country) newErrors.push('Country is required');
    if (newErrors.length) {
      setErrors(newErrors);
      return;
    }

    // Validate cart
    const validation = await validateCart(cart.id);
    if (!validation.valid) {
      setErrors(validation.errors || ['Cart validation failed.']);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createOrder(cart.id, form, selectedShipping || 'standard');
      setOrderResult(result);
    } catch {
      // Demo mode: simulate successful order
      const demoOrder = {
        order: {
          id: `demo-${Date.now()}`,
          orderNumber: `DEMO-${Date.now().toString(36).toUpperCase()}`,
          status: 'PENDING' as const,
          total,
          subtotal: summary?.subtotal || 0,
          tax,
          shipping: shippingCost,
          createdAt: new Date().toISOString(),
          items: summary?.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            name: item.productName,
            unitPrice: item.price,
            quantity: item.quantity,
            total: item.lineTotal,
          })) || [],
        },
        message: 'Order placed successfully (demo mode)',
      };
      setOrderResult(demoOrder);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!store) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (orderResult) {
    return (
      <StorefrontClientShell store={store}>
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Order Confirmed!</h1>
          <p className="mt-4 text-gray-500">Thank you for your order.</p>
          <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 text-left">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Order Number</span>
                <span className="font-mono font-semibold text-gray-900">{orderResult.order.orderNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <span className="font-medium text-gray-900">{orderResult.order.status}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="font-semibold text-gray-900">${orderResult.order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          {orderResult.message && (
            <p className="mt-4 text-sm text-amber-600 bg-amber-50 rounded-xl p-3">{orderResult.message}</p>
          )}
          <Link
            href={`/storefront/${slug}/products`}
            className="inline-block mt-8 rounded-xl bg-gray-900 px-8 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </StorefrontClientShell>
    );
  }

  if (!summary?.items.length) {
    return (
      <StorefrontClientShell store={store}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Checkout</h1>
          <p className="text-gray-500">Your cart is empty.</p>
          <Link
            href={`/storefront/${slug}/products`}
            className="inline-block mt-6 text-indigo-600 hover:text-indigo-700"
          >
            Continue Shopping
          </Link>
        </div>
      </StorefrontClientShell>
    );
  }

  return (
    <StorefrontClientShell store={store}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        {errors.length > 0 && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-100 p-4">
            <p className="text-sm font-medium text-red-800">Please fix the following errors:</p>
            <ul className="mt-2 list-disc list-inside text-sm text-red-700">
              {errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Shipping Address Form */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-gray-100 bg-white p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping Address</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => updateField('firstName', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => updateField('lastName', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={form.addressLine1}
                      onChange={(e) => updateField('addressLine1', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="123 Main St"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2 (optional)</label>
                    <input
                      type="text"
                      value={form.addressLine2}
                      onChange={(e) => updateField('addressLine2', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Apt, Suite, etc."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="New York"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State / Province</label>
                    <input
                      type="text"
                      value={form.state}
                      onChange={(e) => updateField('state', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="NY"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP / Postal Code</label>
                    <input
                      type="text"
                      value={form.zipCode}
                      onChange={(e) => updateField('zipCode', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="10001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <select
                      value={form.country}
                      onChange={(e) => updateField('country', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="GB">United Kingdom</option>
                      <option value="AU">Australia</option>
                      <option value="DE">Germany</option>
                      <option value="FR">France</option>
                      <option value="IN">India</option>
                      <option value="PK">Pakistan</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Shipping Method */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping Method</h2>
                <div className="space-y-3">
                  {shippingMethods.map((method) => (
                    <label
                      key={method.id}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-colors ${
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
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl border border-gray-100 bg-white p-6 lg:sticky lg:top-20">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

                {/* Items */}
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                  {summary.items.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="relative h-12 w-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <Image src={item.image} alt={item.productName} fill className="object-cover" sizes="48px" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-gray-300">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.productName}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <span className="text-sm font-medium text-gray-900">${item.lineTotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-medium text-gray-900">${summary.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Shipping</span>
                    <span className="font-medium text-gray-900">${shippingCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax (estimated)</span>
                    <span className="font-medium text-gray-900">${tax.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-2 flex justify-between">
                    <span className="text-base font-bold text-gray-900">Total</span>
                    <span className="text-base font-bold text-gray-900">${total.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-6 rounded-xl bg-gray-900 py-3.5 text-sm font-semibold text-white hover:bg-gray-800 transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Processing...
                    </span>
                  ) : (
                    `Place Order — $${total.toFixed(2)}`
                  )}
                </button>

                <Link
                  href={`/storefront/${slug}/cart`}
                  className="block w-full mt-3 text-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  &larr; Back to Cart
                </Link>
              </div>
            </div>
          </div>
        </form>
      </div>
    </StorefrontClientShell>
  );
}
