/**
 * ZYRA — Stripe Payment Adapter
 * Stub implementation of the PaymentAdapter interface for Stripe.
 * Replace with real Stripe PaymentIntents / Refunds API calls in production.
 */

import { Injectable } from '@nestjs/common';
import type { PaymentAdapter, PaymentResult } from '../types';

@Injectable()
export class StripeAdapter implements PaymentAdapter {
  async createPayment(params: {
    amount: number;
    currency: string;
    orderId: string;
    customerId?: string;
  }): Promise<PaymentResult> {
    // In production: call Stripe PaymentIntents API
    // POST https://api.stripe.com/v1/payment_intents
    return {
      success: true,
      transactionId: `pi_${Date.now()}`,
      metadata: { provider: 'stripe' },
    };
  }

  async createRefund(params: {
    paymentId: string;
    amount: number;
    reason: string;
  }): Promise<PaymentResult> {
    // In production: call Stripe Refunds API
    // POST https://api.stripe.com/v1/refunds
    return {
      success: true,
      transactionId: `re_${Date.now()}`,
      metadata: { provider: 'stripe' },
    };
  }

  verifyWebhook(payload: unknown, _signature: string, _secret: string): boolean {
    // In production: verify Stripe webhook signature using stripe.webhooks.constructEvent
    // const event = stripe.webhooks.constructEvent(payload, signature, secret);
    return true;
  }
}
