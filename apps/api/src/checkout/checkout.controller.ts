/**
 * ZYRA — Checkout Controller
 * Endpoints: summary, initiate, create-order, confirm, shipping-methods, tax.
 */

import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';
import { CheckoutService } from './checkout.service';
import type {
  CreateOrderFromCartDto,
  CheckoutInitiateResult,
  ShippingMethod,
} from './checkout.service';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  // ── Public (storefront) endpoints ─────────────────────────────────────

  /**
   * POST /checkout/summary
   * Returns the full cost breakdown for the cart, optionally with a discount code.
   */
  @Post('summary')
  summary(@Body() body: { cartId: string; discountCode?: string }) {
    return this.checkoutService.getCheckoutSummary(body.cartId, body.discountCode);
  }

  /**
   * POST /checkout/initiate
   * Validates the cart, customer, products, and inventory before checkout.
   */
  @Post('initiate')
  initiate(@Body() body: { tenantId: string; customerId: string; cartId: string }) {
    return this.checkoutService.initiateCheckout(
      body.tenantId,
      body.customerId,
      body.cartId,
    );
  }

  /**
   * POST /checkout/create-order
   * The main checkout flow: validates → calculates → creates order → creates payment → clears cart.
   */
  @Post('create-order')
  createOrder(@Body() dto: CreateOrderFromCartDto) {
    return this.checkoutService.createOrderFromCart(dto);
  }

  /**
   * POST /checkout/confirm/:orderId
   * Marks the order as CONFIRMED after a successful payment.
   */
  @Post('confirm/:orderId')
  async confirmPayment(
    @Param('orderId') orderId: string,
    @Body() body: { paymentId: string },
  ) {
    if (!body.paymentId) {
      throw new BadRequestException('paymentId is required in request body');
    }
    return this.checkoutService.confirmPayment(orderId, body.paymentId);
  }

  // ── Admin / authenticated endpoints ────────────────────────────────────

  /**
   * GET /checkout/shipping-methods
   * Returns available shipping methods, optionally filtered by cart subtotal.
   */
  @Get('shipping-methods')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  getShippingMethods(
    @Query('tenantId') tenantId: string,
    @Query('cartId') cartId?: string,
  ): Promise<ShippingMethod[]> {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    // If cartId provided, return methods with real subtotal-based pricing
    if (cartId) {
      return this.checkoutService.getCheckoutSummary(cartId).then((summary) =>
        this.checkoutService.getAvailableShippingMethods(summary.subtotal, {}),
      );
    }
    // Default to methods based on zero subtotal (shows base prices)
    return Promise.resolve(this.checkoutService.getAvailableShippingMethods(0, {}));
  }

  /**
   * GET /checkout/tax
   * Calculates tax for a given subtotal and address.
   */
  @Get('tax')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  getTax(
    @Query('subtotal') subtotal: string,
    @Query('state') state?: string,
    @Query('country') country?: string,
  ) {
    const amount = parseFloat(subtotal);
    if (isNaN(amount) || amount < 0) {
      throw new BadRequestException('subtotal must be a valid non-negative number');
    }
    const address: Record<string, unknown> = { state: state ?? 'default', country: country ?? 'IN' };
    return this.checkoutService.applyTax(address, amount);
  }
}
