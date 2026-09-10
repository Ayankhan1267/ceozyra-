/**
 * ZYRA — Checkout Service
 * Bridges cart → order → payment. Reuses CartService, OrderService, PaymentsService.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';
import { OrderService } from '../order/order.service';
import { PaymentsService } from '../payments/payments.service';
import { CartService } from '../cart/cart.service';
import { generateOrderNumber } from '../order/order.service';
import type {
  CartWithItems,
  CreateOrderDto,
} from '../cart/cart.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CheckoutSummaryDto {
  cartId: string;
  items: CheckoutItemDto[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  discountCode?: string;
  discountLabel?: string;
}

export interface CheckoutItemDto {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface CreateOrderFromCartDto {
  tenantId: string;
  customerId: string;
  cartId: string;
  shippingAddress: Record<string, unknown>;
  billingAddress: Record<string, unknown>;
  paymentMethod: 'razorpay' | 'stripe' | 'cod';
  discountCode?: string;
  shippingMethodId?: string;
  notes?: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  description?: string;
  price: number;
  estimatedDays: string;
  freeAbove?: number;
}

export interface CheckoutInitiateResult {
  valid: boolean;
  errors: string[];
  cartSummary: CheckoutSummaryDto;
  availableShippingMethods: ShippingMethod[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CheckoutService {
  private readonly FREE_SHIPPING_THRESHOLD = 5000; // INR — above this, shipping is free
  private readonly DEFAULT_TAX_RATE = 0.18; // 18% GST (India default)

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventBusService,
    private readonly orderService: OrderService,
    private readonly paymentsService: PaymentsService,
    private readonly cartService: CartService,
  ) {}

  // ── Public helpers ─────────────────────────────────────────────────────

  async getCheckoutSummary(cartId: string, discountCode?: string): Promise<CheckoutSummaryDto> {
    const cart = await this.cartService.findById(cartId);
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }
    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty — add items before checking out');
    }

    const items: CheckoutItemDto[] = cart.items.map((item) => ({
      id: item.id,
      productId: item.product.id,
      productName: item.product.name,
      variantId: item.variantId ?? undefined,
      variantName: item.variant?.name,
      image: item.product.images?.[0],
      unitPrice: Number(item.price),
      quantity: item.quantity,
      lineTotal: Number(item.price) * item.quantity,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

    let discount = 0;
    let discountLabel: string | undefined;

    if (discountCode) {
      const result = await this.applyDiscountCode(cart.tenantId, discountCode, subtotal);
      discount = result.discount;
      discountLabel = result.label;
    }

    const shipping = 0; // Default — real value set via applyShipping during create
    const tax = 0; // Default — real value set via applyTax during create

    const total = Math.max(subtotal - discount + shipping + tax, 0);

    return {
      cartId: cart.id,
      items,
      subtotal,
      discount,
      shipping,
      tax,
      total,
      currency: 'INR',
      discountCode: discount ? discountCode : undefined,
      discountLabel,
    };
  }

  async initiateCheckout(
    tenantId: string,
    customerId: string,
    cartId: string,
  ): Promise<CheckoutInitiateResult> {
    const errors: string[] = [];

    // ── Validate cart exists ────────────────────────────────────────────────

    const cart = await this.cartService.findById(cartId);
    if (!cart) {
      errors.push('Cart not found');
      return { valid: false, errors, cartSummary: this._emptySummary(cartId), availableShippingMethods: [] };
    }
    if (cart.tenantId !== tenantId) {
      errors.push('Cart does not belong to this tenant');
    }
    if (cart.items.length === 0) {
      errors.push('Cart is empty');
    }

    // ── Validate customer exists ────────────────────────────────────────────

    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      errors.push('Customer not found');
    }

    // ── Validate products are active ────────────────────────────────────────

    const productIds = cart.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true },
    });
    const activeIds = new Set(products.map((p) => p.id));
    const inactiveItems = cart.items.filter((i) => !activeIds.has(i.productId));
    if (inactiveItems.length > 0) {
      errors.push(`${inactiveItems.length} item(s) are no longer available`);
    }

    // ── Check inventory ─────────────────────────────────────────────────────

    for (const item of cart.items) {
      const inventory = await this.prisma.inventoryItem.findFirst({
        where: { productId: item.productId, variantId: item.variantId ?? undefined },
      });
      const available = inventory?.quantity ?? item.product.inventory ?? 0;
      if (item.quantity > available) {
        errors.push(
          `"${item.product.name}" has only ${available} units in stock (requested ${item.quantity})`,
        );
      }
    }

    const cartSummary = await this.getCheckoutSummary(cartId);
    const availableShippingMethods = this.getAvailableShippingMethods(
      cartSummary.subtotal,
      {} as Record<string, unknown>,
    );

    return {
      valid: errors.length === 0,
      errors,
      cartSummary,
      availableShippingMethods,
    };
  }

  async applyShipping(
    address: Record<string, unknown>,
    cart: CartWithItems,
    shippingMethodId?: string,
  ): Promise<number> {
    const methods = this.getAvailableShippingMethods(cart.items, address);

    if (shippingMethodId) {
      const selected = methods.find((m) => m.id === shippingMethodId);
      if (selected) return selected.price;
    }

    // Default: first method (standard)
    return methods[0]?.price ?? 0;
  }

  async applyTax(address: Record<string, unknown>, subtotal: number): Promise<{ rate: number; amount: number }> {
    const state = (address.state as string) || (address.province as string) || 'default';
    const country = (address.country as string) || 'IN';

    // India GST rates by state
    const taxRates: Record<string, number> = {
      'IN-AP': 0.18, 'IN-KA': 0.18, 'IN-MH': 0.18, 'IN-DL': 0.18,
      'IN-TN': 0.18, 'IN-KL': 0.18, 'IN-GJ': 0.18, 'IN-UP': 0.18,
      'IN-WB': 0.18, 'IN-TS': 0.18,
      default: this.DEFAULT_TAX_RATE,
    };

    const key = `${country}-${state}`;
    const rate = taxRates[key] ?? taxRates.default;
    const amount = Math.round(subtotal * rate);

    return { rate, amount };
  }

  async calculateTotals(
    cartId: string,
    shippingAddress: Record<string, unknown>,
    discountCode?: string,
    shippingMethodId?: string,
  ): Promise<CheckoutSummaryDto> {
    const cart = await this.cartService.findById(cartId);
    if (!cart) throw new NotFoundException('Cart not found');

    const items: CheckoutItemDto[] = cart.items.map((item) => ({
      id: item.id,
      productId: item.product.id,
      productName: item.product.name,
      variantId: item.variantId ?? undefined,
      variantName: item.variant?.name,
      image: item.product.images?.[0],
      unitPrice: Number(item.price),
      quantity: item.quantity,
      lineTotal: Number(item.price) * item.quantity,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

    // ── Discount ─────────────────────────────────────────────────────────────

    let discount = 0;
    let discountLabel: string | undefined;

    if (discountCode) {
      const result = await this.applyDiscountCode(cart.tenantId, discountCode, subtotal);
      discount = result.discount;
      discountLabel = result.label;
    }

    // ── Shipping ─────────────────────────────────────────────────────────────

    const freeShipping = subtotal >= this.FREE_SHIPPING_THRESHOLD;
    const shipping = freeShipping ? 0 : await this.applyShipping(shippingAddress, cart, shippingMethodId);

    // ── Tax ──────────────────────────────────────────────────────────────────

    const { amount: tax } = await this.applyTax(shippingAddress, subtotal);

    const total = Math.max(subtotal - discount + shipping + tax, 0);

    return {
      cartId: cart.id,
      items,
      subtotal,
      discount,
      shipping,
      tax,
      total,
      currency: 'INR',
      discountCode: discount ? discountCode : undefined,
      discountLabel,
    };
  }

  // ── Core flow ──────────────────────────────────────────────────────────

  async createOrderFromCart(dto: CreateOrderFromCartDto) {
    const { tenantId, customerId, cartId, shippingAddress, billingAddress, paymentMethod, discountCode, shippingMethodId, notes } = dto;

    // Step 1 — Validate cart
    const cart = await this.cartService.findById(cartId);
    if (!cart) throw new NotFoundException('Cart not found');
    if (cart.items.length === 0) throw new BadRequestException('Cart is empty');

    // Step 2 — Validate customer
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    // Step 3 — Validate products still active
    const productIds = cart.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true },
    });
    const activeIds = new Set(products.map((p) => p.id));
    const unavailable = cart.items.filter((i) => !activeIds.has(i.productId));
    if (unavailable.length > 0) {
      throw new BadRequestException(
        `The following items are no longer available: ${unavailable.map((i) => i.product.name).join(', ')}`,
      );
    }

    // Step 4 — Check inventory
    for (const item of cart.items) {
      const inv = await this.prisma.inventoryItem.findFirst({
        where: { productId: item.productId, variantId: item.variantId ?? undefined },
      });
      const available = inv?.quantity ?? 0;
      if (item.quantity > available) {
        throw new BadRequestException(
          `Insufficient stock for "${item.product.name}": requested ${item.quantity}, available ${available}`,
        );
      }
    }

    // Step 5 — Calculate totals
    const totals = await this.calculateTotals(cartId, shippingAddress, discountCode, shippingMethodId);

    // Step 6 — Generate order number
    const orderNumber = generateOrderNumber(tenantId);

    // Step 7 — Create the order via OrderService
    const orderDto: CreateOrderDto = {
      orderNumber,
      tenantId,
      customerId,
      storefrontId: cart.storefrontId,
      items: cart.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? undefined,
        quantity: item.quantity,
        unitPrice: Number(item.price),
        name: item.product.name,
      })),
      subtotal: totals.subtotal,
      tax: totals.tax,
      shipping: totals.shipping,
      discount: totals.discount,
      total: totals.total,
      currency: totals.currency,
      shippingAddress,
      billingAddress,
      notes: notes || undefined,
    };

    const order = await this.orderService.create(orderDto);

    // Step 8 — Record coupon usage if applicable
    if (totals.discountCode && totals.discount > 0) {
      await this.recordCouponUsage(tenantId, totals.discountCode, customerId, order.id);
    }

    // Step 9 — Reserve inventory
    await this.reserveInventory(cart.items, order.id);

    // Step 10 — Create payment record
    let payment;
    if (paymentMethod !== 'cod') {
      payment = await this.paymentsService.create({
        orderId: order.id,
        tenantId,
        amount: totals.total,
        currency: totals.currency,
        method: paymentMethod,
        provider: paymentMethod,
        metadata: { orderNumber: order.orderNumber },
      });
    }

    // Step 11 — Clear the cart
    await this.cartService.clear(cartId);

    // Step 12 — Emit event
    this.eventService.emit('checkout.completed', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      tenantId,
      customerId,
      total: totals.total,
      paymentMethod,
      itemCount: cart.items.length,
    });

    return {
      order,
      totals,
      payment: paymentMethod === 'cod' ? null : payment,
    };
  }

  async confirmPayment(orderId: string, paymentId: string) {
    // Validate order exists
    const order = await this.orderService.findById(orderId);

    // Validate payment belongs to order
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, orderId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found for this order');
    }

    // Update payment status
    const updatedPayment = await this.paymentsService.updateStatus(
      paymentId,
      'SUCCEEDED',
      paymentId,
    );

    // Confirm order
    const updatedOrder = await this.orderService.updateStatus(orderId, {
      status: 'CONFIRMED',
    });

    this.eventService.emit('checkout.payment_confirmed', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId,
      tenantId: order.tenantId,
    });

    return {
      order: updatedOrder,
      payment: updatedPayment,
    };
  }

  // ── Shipping methods ──────────────────────────────────────────────────

  getAvailableShippingMethods(
    cartOrSubtotal: number | CartWithItems,
    _address?: Record<string, unknown>,
  ): ShippingMethod[] {
    const subtotal =
      typeof cartOrSubtotal === 'number'
        ? cartOrSubtotal
        : cartOrSubtotal.items.reduce(
            (sum, item) => sum + Number(item.price) * item.quantity,
            0,
          );

    const freeAbove = this.FREE_SHIPPING_THRESHOLD;

    const methods: ShippingMethod[] = [
      {
        id: 'standard',
        name: 'Standard Shipping',
        description: 'Delivered in 5–7 business days',
        price: subtotal >= freeAbove ? 0 : 40,
        estimatedDays: '5–7 business days',
        freeAbove,
      },
      {
        id: 'express',
        name: 'Express Shipping',
        description: 'Delivered in 2–3 business days',
        price: subtotal >= freeAbove ? 0 : 99,
        estimatedDays: '2–3 business days',
        freeAbove,
      },
      {
        id: 'overnight',
        name: 'Overnight Shipping',
        description: 'Next business day delivery',
        price: subtotal >= freeAbove ? 0 : 199,
        estimatedDays: 'Next business day',
        freeAbove,
      },
      {
        id: 'cod',
        name: 'Cash on Delivery',
        description: 'Pay when you receive — free for orders above ₹5,000',
        price: subtotal >= freeAbove ? 0 : 30,
        estimatedDays: '5–7 business days',
        freeAbove,
      },
    ];

    return methods;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async applyDiscountCode(
    tenantId: string,
    code: string,
    subtotal: number,
  ): Promise<{ discount: number; label: string }> {
    const discount = await this.prisma.discount.findFirst({
      where: {
        tenantId,
        code: { equals: code.toUpperCase() },
        isActive: true,
        OR: [
          { startDate: null },
          { startDate: { lte: new Date() } },
        ],
        AND: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
    });

    if (!discount) {
      throw new BadRequestException(`Invalid discount code: ${code}`);
    }

    if (discount.minOrderAmount && subtotal < Number(discount.minOrderAmount)) {
      throw new BadRequestException(
        `Minimum order amount of ₹${Number(discount.minOrderAmount)} required for this code`,
      );
    }

    if (discount.maxUses && discount.usedCount >= discount.maxUses) {
      throw new BadRequestException('This discount code has reached its usage limit');
    }

    const discountValue = Number(discount.value);
    let discountAmount = 0;

    if (discount.type === 'PERCENTAGE') {
      discountAmount = Math.round(subtotal * discountValue / 100);
    } else if (discount.type === 'FIXED_AMOUNT') {
      discountAmount = Math.min(discountValue, subtotal);
    } else if (discount.type === 'FREE_SHIPPING') {
      discountAmount = 0; // Handled separately in shipping calculation
    }

    return {
      discount: discountAmount,
      label: discount.name,
    };
  }

  private async recordCouponUsage(
    tenantId: string,
    code: string,
    customerId: string,
    orderId: string,
  ): Promise<void> {
    const discount = await this.prisma.discount.findFirst({
      where: { tenantId, code: code.toUpperCase() },
    });

    if (!discount) return;

    await this.prisma.couponUsage.create({
      data: {
        tenantId,
        discountId: discount.id,
        customerId,
        orderId,
      },
    });

    await this.prisma.discount.update({
      where: { id: discount.id },
      data: { usedCount: { increment: 1 } },
    });
  }

  private async reserveInventory(
    items: CartWithItems['items'],
    orderId: string,
  ): Promise<void> {
    for (const item of items) {
      const inv = await this.prisma.inventoryItem.findFirst({
        where: { productId: item.productId, variantId: item.variantId ?? undefined },
      });

      if (inv) {
        await this.prisma.inventoryItem.update({
          where: { id: inv.id },
          data: {
            quantity: { decrement: item.quantity },
            reservedQuantity: { increment: item.quantity },
          },
        });
      }

      await this.prisma.inventoryMovement.create({
        data: {
          tenantId: item.product.tenantId,
          productId: item.productId,
          variantId: item.variantId ?? undefined,
          type: 'SALE',
          quantity: -item.quantity,
          reason: `Order ${orderId}`,
          referenceType: 'ORDER',
          referenceId: orderId,
        },
      });
    }
  }

  private _emptySummary(cartId: string): CheckoutSummaryDto {
    return {
      cartId,
      items: [],
      subtotal: 0,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 0,
      currency: 'INR',
    };
  }
}
