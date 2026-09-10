/**
 * ZYRA — Analytics Controller
 */

import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('revenue/tenant/:tenantId')
  @UseGuards(AuthGuard, RolesGuard)
  getRevenueOverTime(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getRevenueOverTime(tenantId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('kpis/tenant/:tenantId')
  @UseGuards(AuthGuard, RolesGuard)
  getKPIs(@Query('tenantId') tenantId: string) {
    return this.analyticsService.getKPIs(tenantId);
  }
}
