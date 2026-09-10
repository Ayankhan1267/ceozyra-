/**
 * ZYRA — Stripe Payment Adapter
 * Real Stripe SDK integration for PaymentIntents, charges, refunds, and webhooks.
 */

import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import type { PaymentAdapter, PaymentResult } from '../types';

// Extended result types for Stripe-specific data
export interface StripePaymentResult extends PaymentResult {
  stripePaymentIntentId?: string;
  stripeClientSecret?: string | null;
  amount?: number;
  currency?: string;
  status?: string;
}

export interface StripeRefundResult extends PaymentResult {
  refundId?: string;
}

export interface StripePaymentIntentDetails {
  id: string;
  status: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  captured: boolean;
  createdAt: number;
}

@Injectable()
export class StripeAdapter implements PaymentAdapter {
  private readonly logger = new Logger(StripeAdapter.name);
  private readonly client: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set — StripeAdapter will operate in no-op mode.'
      );
    }

    this.client = new Stripe(secretKey ?? '', {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * Create a Stripe PaymentIntent.
   * https://stripe.com/docs/api/payment_intents/create
   */
  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, unknown> = {},
  ): Promise<StripePaymentResult> {
    try {
      const paymentIntent = await this.client.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects cents
        currency: currency.toLowerCase(),
        metadata: metadata as Stripe.MetadataParam,
      });

      this.logger.log(
        `Stripe PaymentIntent created: ${paymentIntent.id}`
      );

      return {
        success: true,
        transactionId: paymentIntent.id,
        stripePaymentIntentId: paymentIntent.id,
        stripeClientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        metadata: {
          provider: 'stripe',
          stripePaymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret ?? undefined,
          status: paymentIntent.status,
        },
      };
    } catch (error) {
      this.logger.error(
        `Stripe PaymentIntent creation failed: ${(error as Error).message}`
      );
      throw new Error(
        `Stripe PaymentIntent creation failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Alias for createPaymentIntent — satisfies PaymentAdapter interface.
   */
  async createPayment(params: {
    amount: number;
    currency: string;
    orderId: string;
    customerId?: string;
  }): Promise<PaymentResult> {
    return this.createPaymentIntent(params.amount, params.currency, {
      orderId: params.orderId,
      customerId: params.customerId ?? 'anonymous',
    });
  }

  /**
   * Confirm a PaymentIntent (e.g., after client-side confirmation).
   * https://stripe.com/docs/api/payment_intents/confirm
   */
  async confirmPaymentIntent(paymentIntentId: string): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.client.paymentIntents.confirm(
        paymentIntentId,
      );

      this.logger.log(`Stripe PaymentIntent confirmed: ${paymentIntent.id}`);

      return {
        success:
          paymentIntent.status === 'succeeded' ||
          paymentIntent.status === 'requires_capture',
        transactionId: paymentIntent.id,
        metadata: {
          provider: 'stripe',
          stripePaymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
        },
      };
    } catch (error) {
      this.logger.error(
        `Stripe PaymentIntent confirmation failed for ${paymentIntentId}: ${(error as Error).message}`
      );
      throw new Error(
        `Stripe PaymentIntent confirmation failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Capture a PaymentIntent (for manual capture mode).
   * https://stripe.com/docs/api/payment_intents/capture
   */
  async capturePaymentIntent(
    paymentIntentId: string,
    amount?: number,
  ): Promise<PaymentResult> {
    try {
      const captureParams: Stripe.PaymentIntentCaptureParams = amount !== undefined
        ? { amount_to_capture: Math.round(amount * 100) }
        : {};

      const paymentIntent = await this.client.paymentIntents.capture(
        paymentIntentId,
        captureParams,
      );

      this.logger.log(`Stripe PaymentIntent captured: ${paymentIntent.id}`);

      return {
        success: paymentIntent.status === 'succeeded',
        transactionId: paymentIntent.id,
        metadata: {
          provider: 'stripe',
          stripePaymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          captured: paymentIntent.amount_received,
        },
      };
    } catch (error) {
      this.logger.error(
        `Stripe PaymentIntent capture failed for ${paymentIntentId}: ${(error as Error).message}`
      );
      throw new Error(
        `Stripe PaymentIntent capture failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Alias for capturePaymentIntent — satisfies PaymentAdapter interface.
   */
  async capturePayment(
    paymentIntentId: string,
    amount: number,
  ): Promise<PaymentResult> {
    return this.capturePaymentIntent(paymentIntentId, amount);
  }

  /**
   * Create a refund for a PaymentIntent.
   * https://stripe.com/docs/api/refunds/create
   */
  async createRefund(params: {
    paymentId: string;
    amount: number;
    reason: string;
  }): Promise<StripeRefundResult> {
    try {
      const refund = await this.client.refunds.create({
        payment_intent: params.paymentId,
        amount: Math.round(params.amount * 100),
        reason: this._mapReason(params.reason),
      });

      this.logger.log(
        `Stripe refund created: ${refund.id} for PaymentIntent ${params.paymentId}`
      );

      return {
        success: true,
        transactionId: refund.id,
        refundId: refund.id,
        metadata: {
          provider: 'stripe',
          refundId: refund.id,
          paymentIntentId: params.paymentId,
          status: refund.status,
          amount: refund.amount / 100,
          reason: params.reason,
        },
      };
    } catch (error) {
      this.logger.error(
        `Stripe refund failed for PaymentIntent ${params.paymentId}: ${(error as Error).message}`
      );
      throw new Error(
        `Stripe refund failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Verify Stripe webhook signature.
   * https://stripe.com/docs/webhooks/signatures
   *
   * The raw body (string or Buffer) must be passed for verification.
   */
  verifyWebhook(
    rawBody: string | Buffer,
    signature: string,
    secret: string,
  ): boolean {
    try {
      const event = this.client.webhooks.constructEvent(
        rawBody,
        signature,
        secret,
      );

      this.logger.log(`Stripe webhook verified: ${event.type}`);
      return true;
    } catch (error) {
      this.logger.warn(
        `Stripe webhook signature verification failed: ${(error as Error).message}`
      );
      return false;
    }
  }

  /**
   * Fetch PaymentIntent details.
   * https://stripe.com/docs/api/payment_intents/retrieve
   */
  async getPaymentIntent(
    paymentIntentId: string,
  ): Promise<StripePaymentIntentDetails> {
    try {
      const paymentIntent = await this.client.paymentIntents.retrieve(
        paymentIntentId,
      );

      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        paymentMethod: paymentIntent.payment_method as string | undefined,
        captured: paymentIntent.status === 'succeeded',
        createdAt: paymentIntent.created,
      };
    } catch (error) {
      this.logger.error(
        `Stripe fetch PaymentIntent failed for ${paymentIntentId}: ${(error as Error).message}`
      );
      throw new Error(
        `Stripe fetch PaymentIntent failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get the current status of a refund by fetching the PaymentIntent
   * and checking whether it has been refunded.
   */
  async getRefundStatus(refundId: string): Promise<string> {
    try {
      const refund = await this.client.refunds.retrieve(refundId);
      const statusMap: Record<string, string> = {
        'succeeded': 'SUCCEEDED',
        'pending': 'PROCESSING',
        'failed': 'FAILED',
        'canceled': 'FAILED',
      };
      return statusMap[refund.status ?? ''] ?? 'PROCESSING';
    } catch (error) {
      this.logger.error(
        `Stripe refund status fetch failed for ${refundId}: ${(error as Error).message}`
      );
      return 'PENDING';
    }
  }

  /**
   * Map a freeform reason string to Stripe's accepted refund reason enum.
   */
  private _mapReason(reason: string): 'duplicate' | 'fraudulent' | 'requested_by_customer' {
    const lower = reason.toLowerCase();
    if (lower.includes('duplicate')) return 'duplicate';
    if (lower.includes('fraud')) return 'fraudulent';
    return 'requested_by_customer';
  }
}
