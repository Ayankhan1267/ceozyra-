/**
 * ZYRA — CRM Controller
 * Aggregated endpoints for the CRM dashboard and insights.
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CrmService } from './crm.service';

@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('dashboard')
  @UseGuards(AuthGuard, RolesGuard)
  getDashboard(@Query('tenantId') tenantId: string) {
    return this.crmService.getDashboard(tenantId);
  }

  @Get('insights')
  @UseGuards(AuthGuard, RolesGuard)
  getInsights(@Query('tenantId') tenantId: string) {
    return this.crmService.getInsights(tenantId);
  }
}
