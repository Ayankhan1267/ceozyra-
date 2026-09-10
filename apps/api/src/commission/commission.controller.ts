/**
 * ZYRA — Commission Controller
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CommissionService } from './commission.service';

@Controller('commissions')
export class CommissionController {
  constructor(private readonly commissionService: CommissionService) {}

  @Get('partner/:partnerId')
  @UseGuards(AuthGuard, RolesGuard)
  getByPartner(
    @Param('partnerId') partnerId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.commissionService.getByPartner(partnerId, +page, +limit);
  }

  @Get('head/:headId')
  @UseGuards(AuthGuard, RolesGuard)
  getByHead(
    @Param('headId') headId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.commissionService.getByHead(headId, +page, +limit);
  }

  @Get('tenant/:tenantId')
  @UseGuards(AuthGuard, RolesGuard)
  getByTenant(
    @Param('tenantId') tenantId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.commissionService.getByTenant(tenantId, +page, +limit);
  }

  @Post('calculate')
  @UseGuards(AuthGuard, RolesGuard)
  calculate(@Body() dto: { orderId: string; orderTotal: number; partnerRate: number; headRate: number; partnerUserId: string; headUserId: string; tenantId: string }) {
    const partnerAmount = Number(dto.orderTotal) * (dto.partnerRate / 100);
    const headAmount = Number(dto.orderTotal) * (dto.headRate / 100);
    return this.commissionService.calculateCommissions({
      orderId: dto.orderId,
      orderTotal: Number(dto.orderTotal),
      partnerRate: dto.partnerRate,
      headRate: dto.headRate,
      partnerShare: partnerAmount,
      headShare: headAmount,
      partnerUserId: dto.partnerUserId,
      headUserId: dto.headUserId,
      tenantId: dto.tenantId,
    });
  }

  @Patch(':id/approve')
  @UseGuards(AuthGuard, RolesGuard)
  approve(@Param('id') id: string) {
    return this.commissionService.approve(id);
  }

  @Patch(':id/pay')
  @UseGuards(AuthGuard, RolesGuard)
  markPaid(@Param('id') id: string) {
    return this.commissionService.markPaid(id);
  }

  @Patch(':id/reject')
  @UseGuards(AuthGuard, RolesGuard)
  reject(@Param('id') id: string) {
    return this.commissionService.reject(id);
  }
}
