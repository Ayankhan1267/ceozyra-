/**
 * ZYRA — Discounts & Coupons Service
 * Business logic: validation, application, CRUD, usage tracking, stats.
 */

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';
import type {
  DiscountType,
  DiscountAppliesTo,
} from '@prisma/client';

// ─── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateDiscountDto {
  tenantId: string;
  name: string;
  code?: string;
  type: DiscountType;
  value: number;
  minOrderAmount?: number;
  maxUses?: number;
  startDate?: string;
  endDate?: string;
  appliesTo?: DiscountAppliesTo;
  applicableIds?: string[];
  isActive?: boolean;
}

export interface UpdateDiscountDto {
  name?: string;
  code?: string;
  type?: DiscountType;
  value?: number;
  minOrderAmount?: number;
  maxUses?: number;
  startDate?: string;
  endDate?: string;
  appliesTo?: DiscountAppliesTo;
  applicableIds?: string[];
  isActive?: boolean;
}

export interface DiscountFilter {
  tenantId: string;
  isActive?: boolean;
  type?: DiscountType;
  search?: string;
  page: number;
  limit: number;
}

export interface DiscountValidationResult {
  valid: boolean;
  reason?: string;
  discountId?: string;
  discountAmount: number;
  finalTotal: number;
}

export interface CartItem {
  productId: string;
  categoryId?: string;
  collectionIds?: string[];
  price: number;
  quantity: number;
}

export interface CartSummary {
  items: CartItem[];
  subtotal: number;
  customerId?: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class DiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventBusService,
  ) {}

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async list(filter: DiscountFilter) {
    const where: Record<string, unknown> = { tenantId: filter.tenantId };

    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    if (filter.type) where.type = filter.type;
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' as const } },
        { code: { contains: filter.search, mode: 'insensitive' as const } },
      ];
    }

    const skip = (filter.page - 1) * filter.limit;
    const [discounts, total] = await Promise.all([
      this.prisma.discount.findMany({
        where,
        skip,
        take: filter.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          usages: {
            take: 5,
            orderBy: { usedAt: 'desc' },
            include: {
              customer: { select: { id: true, email: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.discount.count({ where }),
    ]);

    return {
      discounts: discounts.map((d) => ({
        ...d,
        usageCount: d.usages.length,
      })),
      total,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.ceil(total / filter.limit),
    };
  }

  async findById(id: string, tenantId: string) {
    const discount = await this.prisma.discount.findFirst({
      where: { id, tenantId },
      include: {
        usages: {
          take: 20,
          orderBy: { usedAt: 'desc' },
          include: {
            customer: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!discount) throw new NotFoundException('Discount not found');
    return discount;
  }

  async findByIdOrCode(tenantId: string, idOrCode: string) {
    const discount = await this.prisma.discount.findFirst({
      where: {
        tenantId,
        OR: [
          { id: idOrCode },
          ...(idOrCode ? [{ code: idOrCode.toUpperCase() }] : []),
        ],
      },
      include: {
        usages: {
          take: 20,
          orderBy: { usedAt: 'desc' },
          include: {
            customer: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!discount) throw new NotFoundException('Discount not found');
    return discount;
  }

  async create(dto: CreateDiscountDto) {
    if (!dto.code && dto.type !== 'FREE_SHIPPING') {
      throw new BadRequestException('A coupon code is required unless the discount type is FREE_SHIPPING');
    }

    const existing = await this.prisma.discount.findFirst({
      where: {
        tenantId: dto.tenantId,
        code: dto.code?.toUpperCase() ?? null,
      },
    });
    if (existing) {
      throw new BadRequestException(`A discount with code "${dto.code}" already exists`);
    }

    const data: Record<string, unknown> = {
      tenantId: dto.tenantId,
      name: dto.name,
      code: dto.code?.toUpperCase() ?? null,
      type: dto.type,
      value: dto.value,
      minOrderAmount: dto.minOrderAmount ?? 0,
      maxUses: dto.maxUses,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      appliesTo: dto.appliesTo ?? 'ALL',
      applicableIds: dto.applicableIds ?? [],
      isActive: dto.isActive ?? true,
    };

    const discount = await this.prisma.discount.create({
      data: data as any,
      include: { usages: false },
    });

    this.eventService.emit('discount.created', { discountId: discount.id, tenantId: dto.tenantId });
    return discount;
  }

  async update(id: string, tenantId: string, data: UpdateDiscountDto) {
    const discount = await this.prisma.discount.findFirst({
      where: { id, tenantId },
      select: { id: true, tenantId: true },
    });
    if (!discount) throw new NotFoundException('Discount not found');

    const updateData: Record<string, unknown> = { ...data };
    if (updateData.code) updateData.code = (updateData.code as string).toUpperCase();
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate as string);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate as string);

    const updated = await this.prisma.discount.update({
      where: { id },
      data: updateData,
      include: { usages: false },
    });

    this.eventService.emit('discount.updated', { discountId: id, tenantId });
    return updated;
  }

  async delete(id: string, tenantId: string) {
    const discount = await this.prisma.discount.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!discount) throw new NotFoundException('Discount not found');

    await this.prisma.discount.delete({ where: { id } });
    this.eventService.emit('discount.deleted', { discountId: id, tenantId });
    return { success: true };
  }

  // ── Validation ───────────────────────────────────────────────────────────────

  async validate(code: string, tenantId: string, cart: CartSummary): Promise<DiscountValidationResult> {
    const discount = await this.prisma.discount.findFirst({
      where: {
        tenantId,
        OR: [
          { code: code.toUpperCase() },
          { id: code },
        ],
      },
    });

    if (!discount) {
      return { valid: false, reason: 'Discount code not found', discountAmount: 0, finalTotal: cart.subtotal };
    }

    // Check active
    if (!discount.isActive) {
      return { valid: false, reason: 'This discount is no longer active', discountAmount: 0, finalTotal: cart.subtotal };
    }

    // Check date range
    const now = new Date();
    if (discount.startDate && now < discount.startDate) {
      return { valid: false, reason: 'This discount has not started yet', discountAmount: 0, finalTotal: cart.subtotal };
    }
    if (discount.endDate && now > discount.endDate) {
      return { valid: false, reason: 'This discount has expired', discountAmount: 0, finalTotal: cart.subtotal };
    }

    // Check max uses
    if (discount.maxUses && discount.usedCount >= discount.maxUses) {
      return { valid: false, reason: 'This discount has reached its usage limit', discountAmount: 0, finalTotal: cart.subtotal };
    }

    // Check min order amount
    const minOrderAmount = discount.minOrderAmount ? Number(discount.minOrderAmount) : 0;
    if (minOrderAmount > 0 && cart.subtotal < minOrderAmount) {
      return {
        valid: false,
        reason: `Minimum order amount of ${minOrderAmount} not met`,
        discountAmount: 0,
        finalTotal: cart.subtotal,
      };
    }

    // Check customer usage limit
    if (cart.customerId) {
      const customerUsageCount = await this.prisma.couponUsage.count({
        where: { discountId: discount.id, customerId: cart.customerId },
      });
      if (discount.maxUses && customerUsageCount >= discount.maxUses) {
        return {
          valid: false,
          reason: 'You have already used this discount the maximum number of times',
          discountAmount: 0,
          finalTotal: cart.subtotal,
        };
      }
    }

    // Check product applicability
    const applicableItems = await this.getApplicableItems(
      { appliesTo: discount.appliesTo, applicableIds: (discount.applicableIds as string[]) ?? [] },
      cart
    );

    if (applicableItems.length === 0 && discount.appliesTo !== 'ALL') {
      return { valid: false, reason: 'No eligible items in cart for this discount', discountAmount: 0, finalTotal: cart.subtotal };
    }

    // Calculate discount amount
    const discountAmount = this.calculateDiscountAmount(
      { type: discount.type, value: Number(discount.value) },
      applicableItems,
      cart.subtotal
    );
    const finalTotal = Math.max(cart.subtotal - discountAmount, 0);

    return {
      valid: true,
      discountId: discount.id,
      discountAmount,
      finalTotal,
    };
  }

  async apply(code: string, tenantId: string, cart: CartSummary, customerId?: string): Promise<CartSummary & { discountId?: string; discountAmount: number; discountCode: string }> {
    const result = await this.validate(code, tenantId, { ...cart, customerId });
    if (!result.valid) {
      throw new BadRequestException(result.reason);
    }

    const discount = await this.prisma.discount.findUnique({
      where: { id: result.discountId },
      select: { type: true, appliesTo: true, applicableIds: true },
    });
    if (!discount) throw new NotFoundException('Discount not found');

    const discountAmount = result.discountAmount;

    if (discount.type === 'FREE_SHIPPING') {
      return { ...cart, discountCode: code.toUpperCase(), discountAmount, discountId: result.discountId };
    }

    // Apply proportional discount to cart items
    const remainingDiscount = discountAmount;
    const applicableItems = discount.appliesTo === 'ALL'
      ? cart.items
      : await this.getApplicableItems(
          {
            appliesTo: discount.appliesTo,
            applicableIds: (discount.applicableIds as string[]) ?? [],
          },
          cart
        );

    const totalApplicablePrice = applicableItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    let allocated = 0;
    const updatedItems = cart.items.map((item) => {
      if (discount.appliesTo !== 'ALL' && !applicableItems.some(ai => ai.productId === item.productId)) {
        return item;
      }
      const proportion = (item.price * item.quantity) / totalApplicablePrice;
      const itemDiscount = Math.round((remainingDiscount * proportion) * 100) / 100;
      allocated += itemDiscount;
      return { ...item, price: Math.max(item.price - itemDiscount / item.quantity, 0) };
    });

    // Last item gets the rounding remainder
    const roundingAdjustment = discountAmount - allocated;
    const lastUpdatedItem = updatedItems[updatedItems.length - 1];
    updatedItems[updatedItems.length - 1] = {
      ...lastUpdatedItem,
      price: Math.max(lastUpdatedItem.price - roundingAdjustment / lastUpdatedItem.quantity, 0),
    };

    return {
      items: updatedItems,
      subtotal: result.finalTotal,
      discountCode: code.toUpperCase(),
      discountAmount,
      discountId: result.discountId,
    };
  }

  async recordUsage(discountId: string, tenantId: string, customerId: string, orderId: string) {
    const discount = await this.prisma.discount.findFirst({
      where: { id: discountId, tenantId },
    });
    if (!discount) throw new NotFoundException('Discount not found');

    await this.prisma.couponUsage.create({
      data: { discountId, tenantId, customerId, orderId },
    });

    await this.prisma.discount.update({
      where: { id: discountId },
      data: { usedCount: { increment: 1 } },
    });

    this.eventService.emit('discount.used', { discountId, orderId, customerId, tenantId });
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  async getStats(id: string, tenantId: string) {
    const discount = await this.prisma.discount.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!discount) throw new NotFoundException('Discount not found');

    const [
      usageCount,
      usages,
      usageByDate,
    ] = await Promise.all([
      this.prisma.couponUsage.count({ where: { discountId: id } }),
      this.prisma.couponUsage.findMany({
        where: { discountId: id },
        include: {
          customer: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { usedAt: 'desc' },
        take: 50,
      }),
      this.prisma.couponUsage.groupBy({
        by: ['usedAt'],
        where: { discountId: id },
        _count: { usedAt: true },
        orderBy: { usedAt: 'asc' },
      }),
    ]);

    const totalRevenueImpact = 0;

    return {
      usageCount,
      totalRevenueImpact,
      averageOrderValue: usageCount > 0 ? totalRevenueImpact / usageCount : 0,
      recentUsages: usages.map((u) => ({
        customer: u.customer,
        orderId: u.orderId,
        orderTotal: null,
        usedAt: u.usedAt,
      })),
      usageByDay: usageByDate.map((d) => ({
        date: d.usedAt,
        count: d._count.usedAt,
      })),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async getApplicableItems(discount: { appliesTo: DiscountAppliesTo; applicableIds: string[] }, cart: CartSummary): Promise<CartItem[]> {
    if (discount.appliesTo === 'ALL') return cart.items;

    if (discount.appliesTo === 'CATEGORY') {
      return cart.items.filter((item) => discount.applicableIds.includes(item.categoryId ?? ''));
    }

    if (discount.appliesTo === 'PRODUCT') {
      return cart.items.filter((item) => discount.applicableIds.includes(item.productId));
    }

    if (discount.appliesTo === 'COLLECTION') {
      return cart.items.filter((item) =>
        item.collectionIds?.some((cid) => discount.applicableIds.includes(cid))
      );
    }

    return cart.items;
  }

  private calculateDiscountAmount(discount: { type: DiscountType; value: number }, items: CartItem[], cartSubtotal: number): number {
    if (discount.type === 'FREE_SHIPPING') return 0;

    const applicableTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (discount.type === 'PERCENTAGE') {
      return Math.round((applicableTotal * Number(discount.value)) / 10000) / 100;
    }

    if (discount.type === 'FIXED_AMOUNT') {
      return Math.min(Number(discount.value), applicableTotal);
    }

    return 0;
  }
}
