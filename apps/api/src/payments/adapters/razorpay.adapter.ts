/**
 * ZYRA — Razorpay Payment Adapter
 * Stub implementation of the PaymentAdapter interface for Razorpay.
 * Replace with real Razorpay Orders / Refunds API calls in production.
 */

import { Injectable } from '@nestjs/common';
import type { PaymentAdapter, PaymentResult } from '../types';

@Injectable()
export class RazorpayAdapter implements PaymentAdapter {
  async createPayment(params: {
    amount: number;
    currency: string;
    orderId: string;
    customerId?: string;
  }): Promise<PaymentResult> {
    // In production: call Razorpay Orders API
    // POST https://api.razorpay.com/v1/orders
    return {
      success: true,
      transactionId: `rzp_${Date.now()}`,
      metadata: { provider: 'razorpay' },
    };
  }

  async createRefund(params: {
    paymentId: string;
    amount: number;
    reason: string;
  }): Promise<PaymentResult> {
    // In production: call Razorpay Refunds API
    // POST https://api.razorpay.com/v1/payments/{paymentId}/refund
    return {
      success: true,
      transactionId: `rfnd_${Date.now()}`,
      metadata: { provider: 'razorpay' },
    };
  }

  verifyWebhook(payload: unknown, _signature: string, _secret: string): boolean {
    // In production: verify Razorpay webhook signature using HMAC-SHA256
    // return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex') === signature;
    return true;
  }
}
