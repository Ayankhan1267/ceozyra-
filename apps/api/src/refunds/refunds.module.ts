/**
 * ZYRA — Refunds Module
 * Refund lifecycle: create, fetch, list, process.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';
import { OrderModule } from '../order/order.module';
import { PaymentsModule } from '../payments/payments.module';

// Services
import { RefundsService } from './refunds.service';

// Controller
import { RefundsController } from './refunds.controller';

// Adapters (needed by RefundsService)
import { RazorpayAdapter } from '../payments/adapters/razorpay.adapter';
import { StripeAdapter } from '../payments/adapters/stripe.adapter';

@Module({
  imports: [DatabaseModule, EventModule, OrderModule, PaymentsModule],
  controllers: [RefundsController],
  providers: [RefundsService, RazorpayAdapter, StripeAdapter],
  exports: [RefundsService],
})
export class RefundsModule {}
