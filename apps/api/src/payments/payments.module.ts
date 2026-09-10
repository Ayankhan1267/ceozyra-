/**
 * ZYRA — Payments Module
 * Payment orchestration, provider adapters (Razorpay, Stripe), webhooks, refunds.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';
import { OrderModule } from '../order/order.module';

// Service
import { PaymentsService } from './payments.service';

// Adapters
import { RazorpayAdapter } from './adapters/razorpay.adapter';
import { StripeAdapter } from './adapters/stripe.adapter';

// Controller
import { PaymentsController } from './payments.controller';

@Module({
  imports: [DatabaseModule, EventModule, OrderModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayAdapter, StripeAdapter],
  exports: [PaymentsService],
})
export class PaymentsModule {}
