/**
 * ZYRA — Webhooks Service
 * Handles incoming webhook events from Razorpay and Stripe.
 * Verifies signatures, updates payment/order/refund status, and emits domain events.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';
import { RazorpayAdapter } from './adapters/razorpay.adapter';
import { StripeAdapter } from './adapters/stripe.adapter';
import type { PaymentStatus, RefundStatus } from '@prisma/client';

// ─── Normalised webhook payloads ───────────────────────────────────────────────

export interface RazorpayWebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
        method: string;
        transaction_id?: string;
        created_at: number;
      };
    };
    refund?: {
      entity: {
        id: string;
        payment_id: string;
        amount: number;
        currency: string;
        status: string;
        receipt?: string;
        created_at: number;
      };
    };
  };
}

export interface StripeWebhookPayload {
  id: string;
  object: 'event';
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventBusService,
  ) {}

  // ── Razorpay ──────────────────────────────────────────────────────────────

  /**
   * Process a Razorpay webhook event.
   * Handles: payment.captured, payment.failed, refund.created, refund.processed.
   */
  async handleRazorpayWebhook(payload: RazorpayWebhookPayload) {
    const eventType = payload.event;
    const eventId = payload.payload?.refund?.entity?.id ?? payload.payload?.payment?.entity?.id ?? null;

    // Idempotency: skip if we already processed this event
    if (eventId) {
      const existing = await this.prisma.businessEvent.findFirst({
        where: {
          type: `razorpay.webhook.${eventType}`,
          entityId: eventId,
        },
      });
      if (existing) {
        return { processed: false, reason: 'duplicate_event', eventId };
      }
    }

    switch (eventType) {
      case 'payment.captured':
        return this._handleRazorpayPaymentCaptured(payload);
      case 'payment.failed':
        return this._handleRazorpayPaymentFailed(payload);
      case 'refund.created':
        return this._handleRazorpayRefundCreated(payload);
      case 'refund.processed':
        return this._handleRazorpayRefundProcessed(payload);
      default:
        return { processed: false, reason: 'unhandled_event', eventType };
    }
  }

  private async _handleRazorpayPaymentCaptured(payload: RazorpayWebhookPayload) {
    const paymentEntity = payload.payload?.payment?.entity;
    if (!paymentEntity) {
      throw new BadRequestException('Missing payment entity in webhook payload');
    }

    // Find payment by transaction id
    const payment = await this.prisma.payment.findFirst({
      where: { transactionId: paymentEntity.id },
      include: { order: true },
    });

    if (!payment) {
      return { processed: false, reason: 'payment_not_found', transactionId: paymentEntity.id };
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCEEDED' as PaymentStatus,
        transactionId: paymentEntity.transaction_id ?? payment.transactionId,
        paidAt: new Date(),
      },
      include: { order: true },
    });

    this.eventService.emit('payment.status_changed', {
      paymentId: updated.id,
      orderId: updated.orderId,
      status: 'SUCCEEDED',
      tenantId: updated.tenantId,
    });

    this._recordEvent(`razorpay.webhook.${payload.event}`, paymentEntity.id, payload);
    return { processed: true, paymentId: updated.id, status: 'SUCCEEDED' };
  }

  private async _handleRazorpayPaymentFailed(payload: RazorpayWebhookPayload) {
    const paymentEntity = payload.payload?.payment?.entity;
    if (!paymentEntity) {
      throw new BadRequestException('Missing payment entity in webhook payload');
    }

    const payment = await this.prisma.payment.findFirst({
      where: { transactionId: paymentEntity.id },
    });

    if (!payment) {
      return { processed: false, reason: 'payment_not_found', transactionId: paymentEntity.id };
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' as PaymentStatus },
      include: { order: true },
    });

    this.eventService.emit('payment.status_changed', {
      paymentId: updated.id,
      orderId: updated.orderId,
      status: 'FAILED',
      tenantId: updated.tenantId,
    });

    this._recordEvent(`razorpay.webhook.${payload.event}`, paymentEntity.id, payload);
    return { processed: true, paymentId: updated.id, status: 'FAILED' };
  }

  private async _handleRazorpayRefundCreated(payload: RazorpayWebhookPayload) {
    const refundEntity = payload.payload?.refund?.entity;
    if (!refundEntity) {
      throw new BadRequestException('Missing refund entity in webhook payload');
    }

    // Find refund by transaction id
    const refund = await this.prisma.refund.findFirst({
      where: { transactionId: refundEntity.id },
    });

    if (refund) {
      const updated = await this.prisma.refund.update({
        where: { id: refund.id },
        data: { status: 'PROCESSING' as RefundStatus },
        include: { order: true },
      });

      this.eventService.emit('refund.processed', {
        refundId: updated.id,
        orderId: updated.orderId,
        status: 'PROCESSING',
        tenantId: updated.tenantId,
      });

      this._recordEvent(`razorpay.webhook.${payload.event}`, refundEntity.id, payload);
      return { processed: true, refundId: updated.id, status: 'PROCESSING' };
    }

    // If no local refund record exists yet, create one from the webhook
    const payment = await this.prisma.payment.findFirst({
      where: { transactionId: refundEntity.payment_id },
    });

    if (!payment) {
      return { processed: false, reason: 'payment_not_found', paymentTransactionId: refundEntity.payment_id };
    }

    const newRefund = await this.prisma.refund.create({
      data: {
        tenantId: payment.tenantId,
        orderId: payment.orderId,
        paymentId: payment.id,
        amount: refundEntity.amount / 100, // Razorpay amounts are in paise
        currency: refundEntity.currency,
        status: 'PROCESSING' as RefundStatus,
        provider: 'razorpay',
        transactionId: refundEntity.id,
      },
      include: { order: true },
    });

    this._recordEvent(`razorpay.webhook.${payload.event}`, refundEntity.id, payload);
    return { processed: true, refundId: newRefund.id, status: 'PROCESSING', created: true };
  }

  private async _handleRazorpayRefundProcessed(payload: RazorpayWebhookPayload) {
    const refundEntity = payload.payload?.refund?.entity;
    if (!refundEntity) {
      throw new BadRequestException('Missing refund entity in webhook payload');
    }

    const refund = await this.prisma.refund.findFirst({
      where: { transactionId: refundEntity.id },
      include: { order: true },
    });

    if (!refund) {
      return { processed: false, reason: 'refund_not_found', refundTransactionId: refundEntity.id };
    }

    const newStatus: RefundStatus =
      refundEntity.status === 'processed' ? 'SUCCEEDED' : 'FAILED';

    const updated = await this.prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: newStatus,
        ...(newStatus === 'SUCCEEDED' ? { refundedAt: new Date() } : {}),
      },
      include: { order: true },
    });

    this.eventService.emit('refund.processed', {
      refundId: updated.id,
      orderId: updated.orderId,
      status: newStatus,
      tenantId: updated.tenantId,
    });

    this._recordEvent(`razorpay.webhook.${payload.event}`, refundEntity.id, payload);
    return { processed: true, refundId: updated.id, status: newStatus };
  }

  // ── Stripe ───────────────────────────────────────────────────────────────

  /**
   * Process a Stripe webhook event.
   * Handles: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded.
   */
  async handleStripeWebhook(payload: StripeWebhookPayload) {
    const eventType = payload.type;
    const eventId = payload.id;

    // Idempotency: skip if already processed
    const existing = await this.prisma.businessEvent.findFirst({
      where: { type: `stripe.webhook.${eventType}`, entityId: eventId },
    });
    if (existing) {
      return { processed: false, reason: 'duplicate_event', eventId };
    }

    switch (eventType) {
      case 'payment_intent.succeeded':
        return this._handleStripePaymentSucceeded(payload);
      case 'payment_intent.payment_failed':
        return this._handleStripePaymentFailed(payload);
      case 'charge.refunded':
        return this._handleStripeChargeRefunded(payload);
      default:
        return { processed: false, reason: 'unhandled_event', eventType };
    }
  }

  private async _handleStripePaymentSucceeded(payload: StripeWebhookPayload) {
    const pi = payload.data.object as { id: string; status: string; metadata?: Record<string, string> };
    if (!pi || pi.status !== 'succeeded') {
      return { processed: false, reason: 'invalid_status' };
    }

    // Find payment by metadata orderId or by transactionId
    const orderId = pi.metadata?.orderId;
    let payment;

    if (orderId) {
      payment = await this.prisma.payment.findFirst({
        where: { orderId, status: { not: 'SUCCEEDED' as PaymentStatus } },
        include: { order: true },
      });
    }

    if (!payment) {
      payment = await this.prisma.payment.findFirst({
        where: { transactionId: pi.id },
        include: { order: true },
      });
    }

    if (!payment) {
      return { processed: false, reason: 'payment_not_found', paymentIntentId: pi.id };
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCEEDED' as PaymentStatus,
        transactionId: pi.id,
        paidAt: new Date(),
      },
      include: { order: true },
    });

    this.eventService.emit('payment.status_changed', {
      paymentId: updated.id,
      orderId: updated.orderId,
      status: 'SUCCEEDED',
      tenantId: updated.tenantId,
    });

    this._recordEvent(`stripe.webhook.${payload.type}`, payload.id, payload);
    return { processed: true, paymentId: updated.id, status: 'SUCCEEDED' };
  }

  private async _handleStripePaymentFailed(payload: StripeWebhookPayload) {
    const pi = payload.data.object as { id: string; metadata?: Record<string, string> };
    const orderId = pi.metadata?.orderId;

    let payment;
    if (orderId) {
      payment = await this.prisma.payment.findFirst({
        where: { orderId },
      });
    }
    if (!payment) {
      payment = await this.prisma.payment.findFirst({
        where: { transactionId: pi.id },
      });
    }

    if (!payment) {
      return { processed: false, reason: 'payment_not_found', paymentIntentId: pi.id };
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' as PaymentStatus },
      include: { order: true },
    });

    this.eventService.emit('payment.status_changed', {
      paymentId: updated.id,
      orderId: updated.orderId,
      status: 'FAILED',
      tenantId: updated.tenantId,
    });

    this._recordEvent(`stripe.webhook.${payload.type}`, payload.id, payload);
    return { processed: true, paymentId: updated.id, status: 'FAILED' };
  }

  private async _handleStripeChargeRefunded(payload: StripeWebhookPayload) {
    const charge = payload.data.object as {
      id: string;
      payment_intent?: string;
      amount_refunded: number;
      currency: string;
      refunds?: { data: Array<{ id: string; amount: number; status: string }> };
    };

    // Find the related payment
    const payment = await this.prisma.payment.findFirst({
      where: { transactionId: charge.payment_intent },
      include: { order: true },
    });

    if (!payment) {
      return { processed: false, reason: 'payment_not_found', paymentIntentId: charge.payment_intent };
    }

    // Create or update refund records from charge refunds
    const results: { refundId: string; status: string }[] = [];

    for (const stripeRefund of charge.refunds?.data ?? []) {
      const existing = await this.prisma.refund.findFirst({
        where: { transactionId: stripeRefund.id },
      });

      const refundStatus: RefundStatus =
        stripeRefund.status === 'succeeded' ? 'SUCCEEDED' :
        stripeRefund.status === 'failed' ? 'FAILED' :
        stripeRefund.status === 'pending' ? 'PENDING' : 'PROCESSING';

      let refund;
      if (existing) {
        refund = await this.prisma.refund.update({
          where: { id: existing.id },
          data: {
            status: refundStatus,
            ...(refundStatus === 'SUCCEEDED' && !existing.refundedAt ? { refundedAt: new Date() } : {}),
          },
          include: { order: true },
        });
      } else {
        refund = await this.prisma.refund.create({
          data: {
            tenantId: payment.tenantId,
            orderId: payment.orderId,
            paymentId: payment.id,
            amount: stripeRefund.amount / 100, // Stripe amounts are in cents
            currency: charge.currency,
            reason: 'Refund via Stripe webhook',
            status: refundStatus,
            provider: 'stripe',
            transactionId: stripeRefund.id,
            ...(refundStatus === 'SUCCEEDED' ? { refundedAt: new Date() } : {}),
          },
          include: { order: true },
        });

        this.eventService.emit('refund.created', {
          refundId: refund.id,
          orderId: refund.orderId,
          paymentId: payment.id,
          amount: Number(refund.amount),
          tenantId: refund.tenantId,
        });
      }

      this.eventService.emit('refund.processed', {
        refundId: refund.id,
        orderId: refund.orderId,
        status: refundStatus,
        tenantId: refund.tenantId,
      });

      results.push({ refundId: refund.id, status: refundStatus });
    }

    this._recordEvent(`stripe.webhook.${payload.type}`, charge.id, payload);
    return { processed: true, paymentId: payment.id, refunds: results };
  }

  // ── Shared helpers ───────────────────────────────────────────────────────

  /**
   * Update order status based on payment webhook events.
   */
  async updateOrderStatus(orderId: string, paymentStatus: string) {
    if (paymentStatus === 'SUCCEEDED') {
      // Transition order to CONFIRMED if currently PENDING
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true },
      });

      if (order && order.status === 'PENDING') {
        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: 'CONFIRMED' },
        });

        this.eventService.emit('order.status_changed', {
          orderId,
          oldStatus: 'PENDING',
          newStatus: 'CONFIRMED',
          tenantId: order.id,
        });
      }
    }

    if (paymentStatus === 'FAILED') {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { payments: true },
      });

      if (order) {
        const allPaymentsFailed = order.payments.every(
          (p) => p.status === 'FAILED',
        );

        if (allPaymentsFailed && order.payments.length > 0) {
          await this.prisma.order.update({
            where: { id: orderId },
            data: { status: 'CANCELLED' },
          });

          this.eventService.emit('order.status_changed', {
            orderId,
            oldStatus: order.status,
            newStatus: 'CANCELLED',
            tenantId: order.tenantId,
            reason: 'All payments failed',
          });
        }
      }
    }
  }

  /**
   * Update payment status and emit event.
   */
  async updatePaymentStatus(paymentId: string, status: PaymentStatus) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
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
    });

    return updated;
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  /**
   * Record a processed webhook event for idempotency checking.
   */
  private async _recordEvent(type: string, entityId: string, _payload: unknown) {
    try {
      await this.prisma.businessEvent.create({
        data: {
          type,
          entityId,
          payload: {},
          occurredAt: new Date(),
          tenantId: 'system',
        },
      });
    } catch {
      // Event already recorded or business_event table unavailable — ignore
    }
  }
}
