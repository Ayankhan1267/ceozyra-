/**
 * ZYRA — Refunds Controller
 * Endpoints: create refund, get refund detail, list refunds.
 */

import {
  Controller, Get, Post, Body, Param, Query, UseGuards,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';
import { RefundsService } from './refunds.service';

@Controller('refunds')
@UseGuards(AuthGuard, RolesGuard)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  /**
   * POST /refunds
   * Create a new refund for an existing payment.
   */
  @Post()
  @Roles('OWNER', 'ADMIN')
  async create(@Body() dto: any) {
    return this.refundsService.createRefund(dto);
  }

  /**
   * GET /refunds/:id
   * Retrieve a single refund by its ID.
   */
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.refundsService.getRefund(id);
  }

  /**
   * GET /refunds
   * List refunds, optionally filtered by order, payment, tenant, or status.
   */
  @Get()
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  list(
    @Query('tenantId') tenantId?: string,
    @Query('orderId') orderId?: string,
    @Query('paymentId') paymentId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!tenantId && !orderId && !paymentId) {
      throw new BadRequestException(
        'At least one of tenantId, orderId, or paymentId is required.'
      );
    }

    return this.refundsService.listRefunds({
      tenantId,
      orderId,
      paymentId,
      status,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  /**
   * GET /refunds/order/:orderId
   * List all refunds for a specific order.
   */
  @Get('order/:orderId')
  findByOrder(@Param('orderId') orderId: string) {
    return this.refundsService.listByOrder(orderId);
  }

  /**
   * POST /refunds/:id/process
   * Re-process a PENDING refund (e.g., after a webhook confirmation).
   */
  @Post(':id/process')
  @Roles('OWNER', 'ADMIN')
  async process(@Param('id') id: string) {
    return this.refundsService.processRefund(id);
  }
}
