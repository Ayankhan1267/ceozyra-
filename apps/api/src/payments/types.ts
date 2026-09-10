/**
 * ZYRA — Payments Shared Types
 * Imported by both the service and the adapter stubs to avoid circular deps.
 */

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
