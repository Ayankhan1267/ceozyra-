/**
 * ZYRA — Payments Controller
 * Payment endpoints: create, list, process, refund, webhook.
 */

import {
  Controller, Get, Post, Body, Param, Query, UseGuards,
  BadRequestException, NotFoundException, Req, Res, Headers,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';
import { PaymentsService } from './payments.service';
import { WebhooksService } from './webhooks.service';
import type { RazorpayWebhookPayload, StripeWebhookPayload } from './webhooks.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly webhooksService: WebhooksService,
  ) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  list(@Query('tenantId') tenantId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    if (!tenantId) throw new BadRequestException('tenantId is required.');
    return this.paymentsService.findByTenant(tenantId, +(page || 1), +(limit || 20));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findById(id);
  }

  @Get('order/:orderId')
  findByOrder(@Param('orderId') orderId: string) {
    return this.paymentsService.findByOrder(orderId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(@Body() dto: any) {
    return this.paymentsService.create(dto);
  }

  @Post('process')
  @Roles('OWNER', 'ADMIN')
  process(@Body() dto: any) {
    return this.paymentsService.processPayment(dto);
  }

  @Post('refund')
  @Roles('OWNER', 'ADMIN')
  refund(@Body() dto: any) {
    return this.paymentsService.createRefund(dto);
  }

  @Get('refunds/:paymentId')
  getRefunds(@Param('paymentId') paymentId: string) {
    return this.paymentsService.getRefunds(paymentId);
  }

  // ── Webhooks ────────────────────────────────────────────────────────────────

  /**
   * Razorpay webhook endpoint (unauthenticated — provider auth via HMAC signature).
   * Handles: payment.captured, payment.failed, refund.created, refund.processed.
   */
  @Post('webhook/razorpay')
  async razorpayWebhook(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature: string,
  ): Promise<{ received: boolean }> {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      // Dev/fallback mode: accept without verification
      const payload = (req.body?.payload ?? req.body) as RazorpayWebhookPayload;
      await this.webhooksService.handleRazorpayWebhook(payload);
      return { received: true };
    }

    // Verify HMAC-SHA256 signature using raw body
    const RazorpayAdapter = (await import('./adapters/razorpay.adapter')).RazorpayAdapter;
    const rawBody = (req as any).rawBody ?? JSON.stringify(req.body);
    const adapter = new RazorpayAdapter();
    const isValid = adapter.verifyWebhook(rawBody, signature, secret);

    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const payload = (req.body?.payload ?? req.body) as RazorpayWebhookPayload;
    await this.webhooksService.handleRazorpayWebhook(payload);
    return { received: true };
  }

  /**
   * Stripe webhook endpoint (unauthenticated — provider auth via stripe-signature header).
   * Handles: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded.
   */
  @Post('webhook/stripe')
  async stripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      // Dev/fallback mode
      const payload = req.body as StripeWebhookPayload;
      await this.webhooksService.handleStripeWebhook(payload);
      return { received: true };
    }

    const StripeAdapter = (await import('./adapters/stripe.adapter')).StripeAdapter;
    const rawBody = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body));
    const adapter = new StripeAdapter();
    const isValid = adapter.verifyWebhook(rawBody, signature, secret);

    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const payload = req.body as StripeWebhookPayload;
    await this.webhooksService.handleStripeWebhook(payload);
    return { received: true };
  }
}
