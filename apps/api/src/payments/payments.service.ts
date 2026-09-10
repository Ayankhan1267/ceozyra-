/**
 * ZYRA — Payments Service
 * Payment processing, provider adapters, refunds, webhooks.
 */

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
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
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventBusService,
    private readonly razorpayAdapter: RazorpayAdapter,
    private readonly stripeAdapter: StripeAdapter,
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

    // Mark as PROCESSING while SDK call is in flight
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'PROCESSING' },
    });

    // Process through adapter with retry + error handling
    const adapter = this._getAdapter(dto.method);

    try {
      const result = await this._withRetry(() =>
        adapter.createPayment({
          amount: dto.amount,
          currency: dto.currency ?? 'USD',
          orderId: dto.orderId,
          customerId: dto.customerId,
        }),
      );

      const success = result.success ?? false;

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: success ? 'SUCCEEDED' : 'FAILED',
          transactionId: result.transactionId,
          paidAt: success ? new Date() : undefined,
          metadata: JSON.parse(JSON.stringify({
            ...(payment.metadata ? (payment.metadata as Record<string, unknown>) : {}),
            ...(result.metadata ? (result.metadata as Record<string, unknown>) : {}),
          })),
        },
      });

      this.eventService.emit('payment.processed', {
        paymentId: payment.id,
        orderId: dto.orderId,
        success,
        provider: dto.method,
        tenantId: dto.tenantId,
      });

      return { ...payment, success, transactionId: result.transactionId };
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Avoid updating PENDING payments that are already FAILED by a webhook
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });

      this.logger.error(
        `Payment processing failed for payment ${payment.id}: ${errorMessage}`
      );

      throw new BadRequestException(
        `Payment processing failed: ${errorMessage}`
      );
    }
  }

  // ── Webhook Processing ──────────────────────────────────────────────────────

  /**
   * Process an incoming webhook event from a payment provider.
   * Updates payment/refund records and emits internal events.
   */
  async handleWebhookEvent(
    provider: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log(
      `Processing ${provider} webhook: ${eventType}`
    );

    switch (provider) {
      case 'razorpay':
        await this._handleRazorpayWebhook(eventType, payload);
        break;
      case 'stripe':
        await this._handleStripeWebhook(eventType, payload);
        break;
      default:
        this.logger.warn(`Unknown webhook provider: ${provider}`);
    }
  }

  private async _handleRazorpayWebhook(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const entity = payload['entity'] as Record<string, unknown> | undefined;
    if (!entity) return;

    switch (eventType) {
      case 'payment.captured':
        await this._updatePaymentStatus(entity['id'] as string, 'SUCCEEDED', entity['id'] as string);
        break;
      case 'payment.failed':
        await this._updatePaymentStatus(entity['id'] as string, 'FAILED', entity['id'] as string);
        break;
      case 'refund.processed':
        await this._updateRefundStatus(entity['id'] as string, 'SUCCEEDED');
        break;
      case 'refund.failed':
        await this._updateRefundStatus(entity['id'] as string, 'FAILED');
        break;
      default:
        this.logger.debug(`Unhandled Razorpay event: ${eventType}`);
    }
  }

  private async _handleStripeWebhook(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const dataObject = (payload['data'] as { object?: Record<string, unknown> })?.object;
    if (!dataObject) return;

    switch (eventType) {
      case 'payment_intent.succeeded':
        await this._updatePaymentStatus(
          dataObject['id'] as string,
          'SUCCEEDED',
          dataObject['id'] as string,
        );
        break;
      case 'payment_intent.payment_failed':
        await this._updatePaymentStatus(
          dataObject['id'] as string,
          'FAILED',
          dataObject['id'] as string,
        );
        break;
      case 'charge.refunded':
        await this._updatePaymentStatus(
          dataObject['payment_intent'] as string,
          'REFUNDED',
          dataObject['id'] as string,
        );
        break;
      default:
        this.logger.debug(`Unhandled Stripe event: ${eventType}`);
    }
  }

  private async _updatePaymentStatus(
    transactionId: string,
    status: PaymentStatus,
    providerTransactionId: string,
  ): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { transactionId },
      include: { order: true },
    });

    if (!payment) {
      // Try to match by the Razorpay/Stripe order ID in metadata
      this.logger.warn(
        `Payment not found for transactionId ${transactionId} — webhook may need manual reconciliation`
      );
      return;
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status,
        ...(status === 'SUCCEEDED' ? { paidAt: new Date() } : {}),
      },
      include: { order: true },
    });

    this.eventService.emit('payment.status_changed', {
      paymentId: updated.id,
      orderId: updated.orderId,
      status,
      tenantId: updated.tenantId,
      source: 'webhook',
    });
  }

  private async _updateRefundStatus(
    refundTransactionId: string,
    status: 'SUCCEEDED' | 'FAILED',
  ): Promise<void> {
    const refund = await this.prisma.refund.findFirst({
      where: { transactionId: refundTransactionId },
    });

    if (!refund) {
      this.logger.warn(
        `Refund not found for transactionId ${refundTransactionId}`
      );
      return;
    }

    const updated = await this.prisma.refund.update({
      where: { id: refund.id },
      data: {
        status,
        ...(status === 'SUCCEEDED' ? { refundedAt: new Date() } : {}),
      },
    });

    this.eventService.emit('refund.status_changed', {
      refundId: updated.id,
      paymentId: updated.paymentId,
      orderId: updated.orderId,
      status,
      tenantId: updated.tenantId,
    });
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
      const result = await this._withRetry(() =>
        adapter.createRefund({
          paymentId: dto.paymentId,
          amount: dto.amount,
          reason: dto.reason,
        }),
      );

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

  // ── Retry Helper ────────────────────────────────────────────────────────────

  /**
   * Retry an async operation with exponential backoff.
   * Does NOT retry on 4xx errors from payment providers.
   */
  private async _withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    baseDelayMs = 500,
  ): Promise<T> {
    let lastError: Error = new Error('Unknown');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx) or payment failures
        const message = lastError.message.toLowerCase();
        if (
          message.includes('400') ||
          message.includes('401') ||
          message.includes('403') ||
          message.includes('404') ||
          message.includes('card_declined') ||
          message.includes('insufficient')
        ) {
          this.logger.warn(
            `Non-retryable error (attempt ${attempt}): ${lastError.message}`
          );
          throw lastError;
        }

        if (attempt < maxAttempts) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          this.logger.warn(
            `Attempt ${attempt} failed, retrying in ${delay}ms: ${lastError.message}`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(
      `All ${maxAttempts} attempts failed: ${(lastError as Error).message}`
    );
    throw lastError!;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _getAdapter(method: string) {
    switch (method) {
      case 'razorpay':
        return this.razorpayAdapter;
      case 'stripe':
        return this.stripeAdapter;
      default:
        return this.razorpayAdapter;
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
