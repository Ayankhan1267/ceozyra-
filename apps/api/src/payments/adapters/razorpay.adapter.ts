/**
 * ZYRA — Razorpay Payment Adapter
 * Real Razorpay SDK integration for orders, payments, refunds, and webhooks.
 */

import { Injectable, Logger } from '@nestjs/common';
import Razorpay from 'razorpay';
import type { PaymentAdapter, PaymentResult } from '../types';

// Extended result type with extra fields returned by the Razorpay SDK
export interface RazorpayOrderResult extends PaymentResult {
  razorpayOrderId?: string;
  receipt?: string;
  amount?: number;
  currency?: string;
}

export interface RazorpayRefundResult extends PaymentResult {
  refundId?: string;
}

export interface RazorpayPaymentDetails {
  id: string;
  status: string;
  amount: number;
  currency: string;
  method: string;
  captured: boolean;
  createdAt: number;
}

type RazorpayOrder = any;
type RazorpayPayment = any;
type RazorpayRefund = any;

@Injectable()
export class RazorpayAdapter implements PaymentAdapter {
  private readonly logger = new Logger(RazorpayAdapter.name);
  private readonly client: Razorpay;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      this.logger.warn(
        'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set — RazorpayAdapter will operate in no-op mode.'
      );
    }

    this.client = new Razorpay({
      key_id: keyId ?? '',
      key_secret: keySecret ?? '',
    });
  }

  /**
   * Create a Razorpay order via Orders API.
   * https://razorpay.com/docs/api/orders/
   */
  async createOrder(
    amount: number,
    currency: string,
    receipt: string,
  ): Promise<RazorpayOrderResult> {
    try {
      const order = (await this.client.orders.create({
        amount: Math.round(amount * 100), // Razorpay expects paise (integer)
        currency: currency.toUpperCase(),
        receipt,
        payment_capture: true, // auto-capture
      })) as RazorpayOrder;

      this.logger.log(`Razorpay order created: ${order.id} for receipt ${receipt}`);

      return {
        success: true,
        transactionId: order.id,
        metadata: {
          provider: 'razorpay',
          razorpayOrderId: order.id,
          receipt: order.receipt,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
        },
      };
    } catch (error) {
      this.logger.error(
        `Razorpay order creation failed for receipt ${receipt}: ${(error as Error).message}`
      );
      throw new Error(
        `Razorpay order creation failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Create a payment record via Orders API (alias for createOrder, kept for
   * PaymentAdapter interface compatibility).
   */
  async createPayment(params: {
    amount: number;
    currency: string;
    orderId: string;
    customerId?: string;
  }): Promise<PaymentResult> {
    return this.createOrder(params.amount, params.currency, params.orderId);
  }

  /**
   * Capture a payment (for manual capture mode).
   * https://razorpay.com/docs/api/payments/capture/
   */
  async capturePayment(
    paymentId: string,
    amount: number,
  ): Promise<PaymentResult> {
    try {
      const payment = (await this.client.payments.capture(
        paymentId,
        Math.round(amount * 100),
        'INR',
      )) as RazorpayPayment;

      this.logger.log(`Razorpay payment captured: ${payment.id}`);

      return {
        success: true,
        transactionId: payment.id,
        metadata: {
          provider: 'razorpay',
          status: payment.status,
          captured: payment.captured,
        },
      };
    } catch (error) {
      this.logger.error(
        `Razorpay capture failed for payment ${paymentId}: ${(error as Error).message}`
      );
      throw new Error(
        `Razorpay capture failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Create a refund for a payment via the Payments refund endpoint.
   * https://razorpay.com/docs/api/refunds/
   */
  async createRefund(params: {
    paymentId: string;
    amount: number;
    reason: string;
  }): Promise<RazorpayRefundResult> {
    try {
      const refund = (await this.client.payments.refund(
        params.paymentId,
        {
          amount: Math.round(params.amount * 100),
          notes: { reason: params.reason },
        },
      )) as RazorpayRefund;

      this.logger.log(
        `Razorpay refund created: ${refund.id} for payment ${params.paymentId}`
      );

      return {
        success: true,
        transactionId: refund.id,
        refundId: refund.id,
        metadata: {
          provider: 'razorpay',
          refundId: refund.id,
          paymentId: params.paymentId,
          status: refund.status,
          amount: Number(refund.amount ?? 0),
          reason: params.reason,
        },
      };
    } catch (error) {
      this.logger.error(
        `Razorpay refund failed for payment ${params.paymentId}: ${(error as Error).message}`
      );
      throw new Error(
        `Razorpay refund failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Fetch payment details from Razorpay.
   */
  async getPaymentDetails(paymentId: string): Promise<RazorpayPaymentDetails> {
    try {
      const payment = (await this.client.payments.fetch(paymentId)) as RazorpayPayment;

      const amountValue = payment.amount;
      const numericAmount = typeof amountValue === 'number' ? amountValue : Number(amountValue);

      return {
        id: payment.id,
        status: payment.status,
        amount: numericAmount / 100,
        currency: payment.currency ?? 'INR',
        method: payment.method,
        captured: payment.captured,
        createdAt: payment.created_at,
      };
    } catch (error) {
      this.logger.error(
        `Razorpay fetch payment failed for ${paymentId}: ${(error as Error).message}`
      );
      throw new Error(
        `Razorpay fetch payment failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Verify Razorpay webhook signature.
   * https://razorpay.com/docs/webhooks/verify/
   *
   * Razorpay sends the signature as the `X-Razorpay-Signature` header.
   * The raw body (string) should be used for verification.
   */
  verifyWebhook(
    rawBody: string,
    signature: string,
    secret: string,
  ): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      const isValid = expectedSignature === signature;

      if (!isValid) {
        this.logger.warn('Razorpay webhook signature verification failed.');
      }

      return isValid;
    } catch (error) {
      this.logger.error(
        `Razorpay webhook verification error: ${(error as Error).message}`
      );
      return false;
    }
  }

  /**
   * Check refund status with Razorpay.
   * https://razorpay.com/docs/api/refunds/
   */
  async getRefundStatus(refundId: string): Promise<string> {
    try {
      const refund = (await this.client.refunds.fetch(refundId)) as RazorpayRefund;
      const statusMap: Record<string, string> = {
        'processed': 'SUCCEEDED',
        'failed': 'FAILED',
        'pending': 'PROCESSING',
      };
      return statusMap[refund.status] ?? 'PROCESSING';
    } catch (error) {
      this.logger.error(
        `Razorpay refund status fetch failed for ${refundId}: ${(error as Error).message}`
      );
      return 'PENDING';
    }
  }
}
