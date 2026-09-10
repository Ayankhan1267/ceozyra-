/**
 * ZYRA — Order Service
 * Full order lifecycle: create, list, update status, ship, deliver, cancel, invoice
 */

import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateOrderDto {
  orderNumber: string;
  tenantId: string;
  customerId: string;
  storefrontId: string;
  items: {
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
    name: string;
  }[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency?: string;
  shippingAddress?: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  notes?: string;
}

export interface UpdateOrderStatusDto {
  status: OrderStatus;
  reason?: string;
}

export interface ShipOrderDto {
  carrier?: string;
  trackingNumber: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  shippingAddress?: Record<string, unknown>;
}

export interface CancelOrderDto {
  reason: string;
}

export interface OrderFilterDto {
  tenantId?: string;
  status?: OrderStatus;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface RefundCreateDto {
  orderId: string;
  amount: number;
  reason: string;
  paymentId?: string;
}

export interface RefundProcessDto {
  transactionId: string;
}

// ---------------------------------------------------------------------------
// Order Number Generator
// ---------------------------------------------------------------------------

export function generateOrderNumber(tenantId: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const shortTenant = tenantId.slice(-4).toUpperCase();
  return `ORD-${shortTenant}-${ts}`;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventBusService,
  ) {}

  // ── Query ──────────────────────────────────────────────────────────────

  async findByTenant(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { tenantId },
        skip,
        take: limit,
        include: {
          customer: true,
          items: { include: { product: true, variant: true } },
          payments: true,
          shipments: true,
          refunds: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: { tenantId } }),
    ]);
    return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true, variant: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        shipments: { orderBy: { createdAt: 'desc' } },
        refunds: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findByCustomer(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByOrderNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        customer: true,
        items: { include: { product: true, variant: true } },
        payments: true,
        shipments: true,
        refunds: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async filter(dto: OrderFilterDto) {
    const { status, customerId, startDate, endDate, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;
    const where: Prisma.OrderWhereInput = {};

    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(startDate);
      if (endDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: true,
          items: { include: { product: true } },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getStats(tenantId: string) {
    const [
      totalOrders,
      totalRevenue,
      pendingOrders,
      confirmedOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      completedOrders,
      cancelledOrders,
      refundedOrders,
    ] = await Promise.all([
      this.prisma.order.count({ where: { tenantId } }),
      this.prisma.order.aggregate({
        where: { tenantId, status: 'COMPLETED' },
        _sum: { total: true },
      }),
      this.prisma.order.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.order.count({ where: { tenantId, status: 'CONFIRMED' } }),
      this.prisma.order.count({ where: { tenantId, status: 'PROCESSING' } }),
      this.prisma.order.count({ where: { tenantId, status: 'SHIPPED' } }),
      this.prisma.order.count({ where: { tenantId, status: 'DELIVERED' } }),
      this.prisma.order.count({ where: { tenantId, status: 'COMPLETED' } }),
      this.prisma.order.count({ where: { tenantId, status: 'CANCELLED' } }),
      this.prisma.order.count({ where: { tenantId, status: 'REFUNDED' } }),
    ]);

    return {
      totalOrders,
      totalRevenue: Number(totalRevenue._sum.total) || 0,
      byStatus: {
        pending: pendingOrders,
        confirmed: confirmedOrders,
        processing: processingOrders,
        shipped: shippedOrders,
        delivered: deliveredOrders,
        completed: completedOrders,
        cancelled: cancelledOrders,
        refunded: refundedOrders,
      },
    };
  }

  // ── Mutations ──────────────────────────────────────────────────────────

  async create(dto: CreateOrderDto) {
    // Ensure unique order number
    const existing = await this.prisma.order.findFirst({
      where: { orderNumber: dto.orderNumber },
    });
    if (existing) {
      throw new ConflictException(`Order number ${dto.orderNumber} already exists`);
    }

    const order = await this.prisma.order.create({
      data: {
        orderNumber: dto.orderNumber,
        customerId: dto.customerId,
        tenantId: dto.tenantId,
        storefrontId: dto.storefrontId,
        subtotal: dto.subtotal,
        tax: dto.tax,
        shipping: dto.shipping,
        discount: dto.discount,
        total: dto.total,
        currency: dto.currency ?? 'USD',
        shippingAddress: dto.shippingAddress as any,
        billingAddress: dto.billingAddress as any,
        notes: dto.notes,
        status: 'PENDING',
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            price: item.unitPrice,
            total: item.unitPrice * item.quantity,
            name: item.name,
          })),
        },
      },
      include: {
        customer: true,
        items: { include: { product: true, variant: true } },
      },
    });

    this.eventService.emit('order.created', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      tenantId: order.tenantId,
      total: order.total,
      customerId: order.customerId,
    });

    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    // Validate status transitions
    this.assertValidTransition(order.status, dto.status);

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      include: {
        customer: true,
        items: { include: { product: true, variant: true } },
        payments: true,
        shipments: true,
      },
    });

    this.eventService.emit('order.status_changed', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      oldStatus: order.status,
      newStatus: dto.status,
      tenantId: order.tenantId,
      reason: dto.reason,
    });

    return updated;
  }

  async ship(id: string, dto: ShipOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (!['CONFIRMED', 'PROCESSING'].includes(order.status)) {
      throw new BadRequestException(
        `Cannot ship order in status: ${order.status}. Must be CONFIRMED or PROCESSING.`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'SHIPPED',
        shipments: {
          create: {
            tenantId: order.tenantId,
            carrier: dto.carrier,
            trackingNumber: dto.trackingNumber,
            status: 'IN_TRANSIT',
            address: JSON.parse(JSON.stringify(dto.shippingAddress ?? {})),
            shippedAt: new Date(),
          },
        },
      },
      include: {
        customer: true,
        items: { include: { product: true } },
        shipments: true,
      },
    });

    this.eventService.emit('order.shipped', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      tenantId: order.tenantId,
      trackingNumber: dto.trackingNumber,
      carrier: dto.carrier,
    });

    return updated;
  }

  async deliver(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'SHIPPED') {
      throw new BadRequestException(`Cannot deliver order in status: ${order.status}. Must be SHIPPED.`);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: 'DELIVERED' },
      include: {
        customer: true,
        items: { include: { product: true } },
        shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    // Mark the latest shipment as delivered
    const latestShipment = await this.prisma.shipment.findFirst({
      where: { orderId: id },
      orderBy: { createdAt: 'desc' },
    });
    if (latestShipment) {
      await this.prisma.shipment.update({
        where: { id: latestShipment.id },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      });
    }

    this.eventService.emit('order.delivered', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      tenantId: order.tenantId,
    });

    return updated;
  }

  async cancel(id: string, dto: CancelOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { payments: true, refunds: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (['CANCELLED', 'COMPLETED', 'REFUNDED'].includes(order.status)) {
      throw new BadRequestException(`Cannot cancel order in status: ${order.status}`);
    }

    // Check if payment was made — if so, require refund
    const paidPayments = order.payments.filter((p) => p.status === 'SUCCEEDED');
    const totalRefunded = order.refunds
      .filter((r) => r.status === 'PROCESSING' || r.status === 'SUCCEEDED')
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: order.notes
          ? `${order.notes}\n[Cancelled] ${dto.reason}`
          : `[Cancelled] ${dto.reason}`,
      },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: true,
      },
    });

    this.eventService.emit('order.cancelled', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      tenantId: order.tenantId,
      reason: dto.reason,
      requiresRefund: paidPayments.length > 0 && totalRefunded < Number(order.total),
    });

    return updated;
  }

  async complete(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'DELIVERED') {
      throw new BadRequestException('Order must be delivered before marking as completed');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: { customer: true, items: { include: { product: true } } },
    });

    this.eventService.emit('order.completed', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      tenantId: order.tenantId,
      total: order.total,
    });

    return updated;
  }

  // ── Invoice ────────────────────────────────────────────────────────────

  async getInvoiceData(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: true,
        shipments: true,
        refunds: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private assertValidTransition(current: OrderStatus, next: OrderStatus): void {
    const allowed: Record<OrderStatus, OrderStatus[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['DELIVERED'],
      DELIVERED: ['COMPLETED', 'REFUNDED'],
      COMPLETED: ['REFUNDED'],
      CANCELLED: [],
      REFUNDED: [],
    };

    if (!allowed[current]?.includes(next)) {
      throw new BadRequestException(
        `Invalid status transition: ${current} → ${next}. Allowed: ${allowed[current]?.join(', ') || 'none'}`,
      );
    }
  }
}
