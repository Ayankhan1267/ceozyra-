/**
 * ZYRA — Payments Service
 * Payment processing, provider adapters, refunds, webhooks.
 */

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';
import { RazorpayAdapter } from './adapters/razorpay.adapter';
import { StripeAdapter } from './adapters/stripe.adapter';

// ─── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreatePaymentDto {
  orderId: string;
  tenantId: string;
  amount: number;
  currency?: string;
  method: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}

export interface ProcessPaymentDto {
  orderId: string;
  tenantId: string;
  method: 'razorpay' | 'stripe';
  amount: number;
  currency?: string;
  customerId?: string;
}

export interface CreateRefundDto {
  orderId: string;
  paymentId: string;
  amount: number;
  reason: string;
}

export interface PaymentFilterDto {
  tenantId?: string;
  orderId?: string;
  status?: string;
  method?: string;
  page?: number;
  limit?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventBusService,
  ) {}

  // ── Payments ────────────────────────────────────────────────────────────────

  async findByTenant(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { tenantId },
        skip,
        take: limit,
        include: { order: { select: { id: true, orderNumber: true } }, refunds: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where: { tenantId } }),
    ]);
    return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { order: true, refunds: { orderBy: { createdAt: 'desc' } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async findByOrder(orderId: string) {
    return this.prisma.payment.findMany({
      where: { orderId },
      include: { refunds: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreatePaymentDto) {
    return this.prisma.payment.create({
      data: {
        tenantId: dto.tenantId,
        orderId: dto.orderId,
        amount: dto.amount,
        currency: dto.currency ?? 'USD',
        method: dto.method,
        provider: dto.provider,
        status: 'PENDING',
        metadata: dto.metadata as Prisma.InputJsonValue,
      },
      include: { order: true },
    });
  }

  async updateStatus(id: string, status: string, transactionId?: string) {
    const data: Record<string, unknown> = {
      status: status as PaymentStatus,
      ...(transactionId ? { transactionId } : {}),
      ...(status === 'SUCCEEDED' ? { paidAt: new Date() } : {}),
    };

    const payment = await this.prisma.payment.update({
      where: { id },
      data: data as Parameters<typeof this.prisma.payment.update>[0]['data'],
      include: { order: true, refunds: true },
    });

    this.eventService.emit('payment.status_changed', {
      paymentId: payment.id,
      orderId: payment.orderId,
      status,
      tenantId: payment.tenantId,
    });

    return payment;
  }

  async processPayment(dto: ProcessPaymentDto) {
    // Find or create payment record
    const existing = await this.prisma.payment.findFirst({
      where: { orderId: dto.orderId, status: 'PENDING' },
    });

    const paymentData: Prisma.PaymentUncheckedCreateInput = {
      tenantId: dto.tenantId,
      orderId: dto.orderId,
      amount: dto.amount,
      currency: dto.currency ?? 'USD',
      method: dto.method,
      status: 'PENDING',
    };

    let payment: Prisma.PaymentGetPayload<{ include: { order: true } }>;

    if (existing) {
      payment = await this.prisma.payment.update({
        where: { id: existing.id },
        data: paymentData,
        include: { order: true },
      });
    } else {
      payment = await this.prisma.payment.create({
        data: paymentData,
        include: { order: true },
      });
    }

    // Process through adapter
    const adapter = this._getAdapter(dto.method);
    try {
      const result = await adapter.createPayment({
        amount: dto.amount,
        currency: dto.currency ?? 'USD',
        orderId: dto.orderId,
        customerId: dto.customerId,
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: result.success ? 'SUCCEEDED' : 'FAILED',
          transactionId: result.transactionId,
          paidAt: result.success ? new Date() : undefined,
          metadata: JSON.parse(JSON.stringify({
            ...(payment.metadata ? (payment.metadata as Record<string, unknown>) : {}),
            ...(result.metadata ? (result.metadata as Record<string, unknown>) : {}),
          })),
        },
      });

      this.eventService.emit('payment.processed', {
        paymentId: payment.id,
        orderId: dto.orderId,
        success: result.success,
        provider: dto.method,
        tenantId: dto.tenantId,
      });

      return { ...payment, success: result.success, transactionId: result.transactionId };
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException(`Payment processing failed: ${(error as Error).message}`);
    }
  }

  // ── Refunds ─────────────────────────────────────────────────────────────────

  async getRefunds(paymentId: string) {
    return this.prisma.refund.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRefund(dto: CreateRefundDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: { refunds: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const totalRefunded = payment.refunds
      .filter((r) => r.status === 'PROCESSING' || r.status === 'SUCCEEDED')
      .reduce((sum, r) => sum + Number(r.amount), 0);

    if (totalRefunded + dto.amount > Number(payment.amount)) {
      throw new BadRequestException(
        `Refund amount exceeds remaining balance. Available: ${(Number(payment.amount) - totalRefunded).toFixed(2)}`
      );
    }

    const adapter = this._getAdapter(payment.method);
    try {
      const result = await adapter.createRefund({
        paymentId: dto.paymentId,
        amount: dto.amount,
        reason: dto.reason,
      });

      const refund = await this.prisma.refund.create({
        data: {
          tenantId: payment.tenantId,
          orderId: payment.orderId,
          paymentId: dto.paymentId,
          amount: dto.amount,
          currency: payment.currency,
          reason: dto.reason,
          status: result.success ? 'PROCESSING' : 'PENDING',
          provider: payment.provider,
          transactionId: result.transactionId,
          refundedAt: result.success ? new Date() : undefined,
        },
      });

      this.eventService.emit('refund.created', {
        refundId: refund.id,
        paymentId: dto.paymentId,
        orderId: payment.orderId,
        amount: dto.amount,
        tenantId: payment.tenantId,
      });

      return refund;
    } catch (error) {
      throw new BadRequestException(`Refund failed: ${(error as Error).message}`);
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _getAdapter(method: string) {
    switch (method) {
      case 'razorpay':
        return new RazorpayAdapter();
      case 'stripe':
        return new StripeAdapter();
      default:
        return new RazorpayAdapter();
    }
  }
}

// ─── Adapters ─────────────────────────────────────────────────────────────────

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentAdapter {
  createPayment(params: {
    amount: number;
    currency: string;
    orderId: string;
    customerId?: string;
  }): Promise<PaymentResult>;

  createRefund(params: {
    paymentId: string;
    amount: number;
    reason: string;
  }): Promise<PaymentResult>;

  verifyWebhook(payload: unknown, signature: string, secret: string): boolean;
}
