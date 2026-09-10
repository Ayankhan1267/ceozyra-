/**
 * ZYRA — Checkout Module
 * Bridges cart → order → payment. Depends on Cart, Order, Payments, and Database modules.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';
import { CartModule } from '../cart/cart.module';
import { OrderModule } from '../order/order.module';
import { PaymentsModule } from '../payments/payments.module';

// Service
import { CheckoutService } from './checkout.service';

// Controller
import { CheckoutController } from './checkout.controller';

@Module({
  imports: [DatabaseModule, EventModule, CartModule, OrderModule, PaymentsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
