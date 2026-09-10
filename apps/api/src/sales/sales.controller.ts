/**
 * ZYRA — Sales Controller (Phase 3.3)
 * Routes: /sales/*
 */

import { Controller, Get, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { SalesService } from './sales.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermission } from '../rbac/permissions.decorator';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // ── Next Best Action ──────────────────────────────────────────────

  @Get('next-best-action/:customerId')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('customers', 'read')
  getNextBestAction(@Param('customerId') customerId: string) {
    return this.salesService.getNextBestAction(customerId);
  }

  // ── Funnel ────────────────────────────────────────────────────────

  @Get('funnel')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('sales', 'read')
  getFunnel(@Query('tenantId') tenantId: string) {
    if (!tenantId) throw new BadRequestException('tenantId is required.');
    return this.salesService.getSalesFunnel(tenantId);
  }

  // ── Conversion Rate ───────────────────────────────────────────────

  @Get('conversion-rate')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('sales', 'read')
  getConversionRate(@Query('tenantId') tenantId: string, @Query('period') period = '30d') {
    if (!tenantId) throw new BadRequestException('tenantId is required.');
    return this.salesService.getConversionRate(tenantId, period);
  }

  // ── Follow-up Suggestion ──────────────────────────────────────────

  @Get('follow-up/:leadId')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('leads', 'read')
  getFollowUp(@Param('leadId') leadId: string) {
    return this.salesService.suggestFollowUp(leadId);
  }

  // ── Win / Loss Analysis ───────────────────────────────────────────

  @Get('win-loss')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('sales', 'read')
  getWinLoss(@Query('tenantId') tenantId: string) {
    if (!tenantId) throw new BadRequestException('tenantId is required.');
    return this.salesService.getWinLossAnalysis(tenantId);
  }
}
