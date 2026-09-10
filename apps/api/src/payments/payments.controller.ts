/**
 * ZYRA — Payments Controller
 * Payment endpoints: create, list, process, refund, webhook.
 */

import {
  Controller, Get, Post, Body, Param, Query, UseGuards,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(AuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

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

  @Post('webhook/:provider')
  webhook(@Param('provider') provider: string, @Body() payload: any) {
    return { received: true, provider };
  }
}
