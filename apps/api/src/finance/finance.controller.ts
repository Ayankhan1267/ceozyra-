/**
 * ZYRA — Finance Controller
 */

import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('pnl/tenant/:tenantId')
  @UseGuards(AuthGuard, RolesGuard)
  async getPnL(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getPnL(
      tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('metrics/tenant/:tenantId')
  @UseGuards(AuthGuard, RolesGuard)
  getMetrics(@Query('tenantId') tenantId: string) {
    return this.financeService.getMetrics(tenantId);
  }
}
