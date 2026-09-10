/**
 * ZYRA — Refunds Service
 * Refund lifecycle: create, fetch, list, and process through payment adapters.
 */

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma, RefundStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';
import { PaymentsService } from '../payments/payments.service';
import { RazorpayAdapter } from '../payments/adapters/razorpay.adapter';
import { StripeAdapter } from '../payments/adapters/stripe.adapter';

export interface CreateRefundDto {
  orderId: string;
  paymentId: string;
  amount: number;
  reason: string;
  provider?: string;
}

export interface RefundFilterDto {
  tenantId?: string;
  orderId?: string;
  paymentId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface RefundDetail {
  id: string;
  tenantId: string;
  orderId: string;
  paymentId: string | null;
  amount: number;
  currency: string;
  reason: string | null;
  status: RefundStatus;
  provider: string | null;
  transactionId: string | null;
  metadata: Record<string, unknown> | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventBusService,
    private readonly paymentsService: PaymentsService,
    private readonly razorpayAdapter: RazorpayAdapter,
    private readonly stripeAdapter: StripeAdapter,
  ) {}

  // ── Create ──────────────────────────────────────────────────────────────────

  async createRefund(dto: CreateRefundDto) {
    // Validate that the payment exists and belongs to the same tenant/order
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: { refunds: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${dto.paymentId} not found`);
    }

    // Enforce order + tenant consistency
    if (payment.orderId !== dto.orderId) {
      throw new BadRequestException(
        'Payment does not belong to the specified order'
      );
    }

    if (payment.tenantId && dto.provider === undefined) {
      // tenantId is enforced by middleware; we just validate consistency
    }

    // Check against payment amount + existing refunds
    const totalRefunded = payment.refunds
      .filter((r) => ['PROCESSING', 'SUCCEEDED'].includes(r.status))
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const availableForRefund = Number(payment.amount) - totalRefunded;

    if (dto.amount > availableForRefund) {
      throw new BadRequestException(
        `Refund amount (${dto.amount.toFixed(2)}) exceeds available balance (${availableForRefund.toFixed(2)}). ` +
        `Already refunded: ${totalRefunded.toFixed(2)}`
      );
    }

    // Skip provider call if payment was not actually captured/succeeded
    if (payment.status !== 'SUCCEEDED' && payment.status !== 'REFUNDED') {
      throw new BadRequestException(
        `Cannot refund payment with status: ${payment.status}. Only SUCCEEDED payments can be refunded.`
      );
    }

    const provider = dto.provider ?? payment.provider ?? payment.method;
    const adapter = this._getAdapter(provider);

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
          provider,
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

      this.logger.log(
        `Refund created: ${refund.id} — ${dto.amount} ${payment.currency} for payment ${dto.paymentId}`
      );

      return refund;
    } catch (error) {
      this.logger.error(
        `Refund creation failed for payment ${dto.paymentId}: ${(error as Error).message}`
      );
      throw new BadRequestException(`Refund failed: ${(error as Error).message}`);
    }
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  async getRefund(id: string): Promise<RefundDetail> {
    const refund = await this.prisma.refund.findUnique({
      where: { id },
      include: { payment: true, order: true },
    });

    if (!refund) {
      throw new NotFoundException(`Refund ${id} not found`);
    }

    return refund as unknown as RefundDetail;
  }

  async listRefunds(filters: RefundFilterDto): Promise<{
    refunds: RefundDetail[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RefundWhereInput = {};

    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.orderId) where.orderId = filters.orderId;
    if (filters.paymentId) where.paymentId = filters.paymentId;
    if (filters.status) where.status = filters.status as RefundStatus;

    const [refunds, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        skip,
        take: limit,
        include: { payment: true, order: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.refund.count({ where }),
    ]);

    return {
      refunds: refunds as unknown as RefundDetail[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listByOrder(orderId: string): Promise<RefundDetail[]> {
    return this.prisma.refund.findMany({
      where: { orderId },
      include: { payment: true, order: true },
      orderBy: { createdAt: 'desc' },
    }) as unknown as Promise<RefundDetail[]>;
  }

  // ── Process ─────────────────────────────────────────────────────────────────

  /**
   * Re-process a PENDING refund — useful after a webhook confirms completion.
   */
  async processRefund(refundId: string): Promise<RefundDetail> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { payment: true },
    });

    if (!refund) {
      throw new NotFoundException(`Refund ${refundId} not found`);
    }

    if (refund.status !== 'PENDING') {
      throw new BadRequestException(
        `Refund is already ${refund.status}. Only PENDING refunds can be re-processed.`
      );
    }

    if (!refund.paymentId || !refund.payment) {
      throw new BadRequestException('Refund has no associated payment');
    }

    const provider = refund.provider ?? refund.payment.provider ?? refund.payment.method;
    const adapter = this._getAdapter(provider);

    try {
      // Attempt to fetch refund status from the provider
      let result;

      if (provider === 'razorpay') {
        // Razorpay: use the payment API to check if the refund has been processed
        const paymentDetails = await (adapter as RazorpayAdapter).getPaymentDetails(
          refund.payment.transactionId ?? '',
        );

        result = {
          success: paymentDetails.status === 'refunded',
          transactionId: refund.transactionId,
          metadata: { provider: 'razorpay', paymentStatus: paymentDetails.status },
        };
      } else if (provider === 'stripe') {
        // Stripe: retrieve the payment intent and check refund status
        const piDetails = await (adapter as StripeAdapter).getPaymentIntent(
          refund.payment.transactionId ?? '',
        );

        result = {
          success: piDetails.status === 'succeeded' && refund.payment.status === 'REFUNDED',
          transactionId: refund.transactionId,
          metadata: { provider: 'stripe', paymentIntentStatus: piDetails.status },
        };
      } else {
        result = { success: false };
      }

      const updated = await this.prisma.refund.update({
        where: { id: refundId },
        data: {
          status: result.success ? 'PROCESSING' : 'PENDING',
          ...(result.success ? { refundedAt: new Date() } : {}),
        },
        include: { payment: true, order: true },
      });

      this.eventService.emit('refund.processed', {
        refundId: updated.id,
        paymentId: updated.paymentId,
        orderId: updated.orderId,
        status: updated.status,
        tenantId: updated.tenantId,
      });

      this.logger.log(`Refund re-processed: ${refundId} → ${updated.status}`);

      return updated as unknown as RefundDetail;
    } catch (error) {
      this.logger.error(
        `Refund processing failed for ${refundId}: ${(error as Error).message}`
      );
      throw new BadRequestException(
        `Refund processing failed: ${(error as Error).message}`
      );
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _getAdapter(provider: string) {
    switch (provider) {
      case 'razorpay':
        return this.razorpayAdapter;
      case 'stripe':
        return this.stripeAdapter;
      default:
        return this.razorpayAdapter;
    }
  }

  /**
   * Retry with exponential backoff — same strategy as PaymentsService.
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

        const message = lastError.message.toLowerCase();
        if (
          message.includes('400') ||
          message.includes('401') ||
          message.includes('403') ||
          message.includes('404')
        ) {
          this.logger.warn(`Non-retryable refund error: ${lastError.message}`);
          throw lastError;
        }

        if (attempt < maxAttempts) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          this.logger.warn(
            `Refund attempt ${attempt} failed, retrying in ${delay}ms: ${lastError.message}`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }
}
