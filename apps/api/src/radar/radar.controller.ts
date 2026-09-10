/**
 * ZYRA — Radar Controller (Phase 7.1)
 */

import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import { RadarService, HealthScores, Anomaly, Opportunity, Alert } from './radar.service';

@Controller('radar')
export class RadarController {
  constructor(private readonly radarService: RadarService) {}

  @Get('health')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('radar', 'read')
  async getHealth(@Query('tenantId') tenantId: string): Promise<HealthScores> {
    return this.radarService.runHealthCheck(tenantId);
  }

  @Get('anomalies')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('radar', 'read')
  async getAnomalies(@Query('tenantId') tenantId: string): Promise<Anomaly[]> {
    return this.radarService.detectAnomalies(tenantId);
  }

  @Get('opportunities')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('radar', 'read')
  async getOpportunities(@Query('tenantId') tenantId: string): Promise<Opportunity[]> {
    return this.radarService.identifyOpportunities(tenantId);
  }

  @Get('alerts')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('radar', 'read')
  async getAlerts(@Query('tenantId') tenantId: string): Promise<Alert[]> {
    return this.radarService.generateAlerts(tenantId);
  }

  @Post('run')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('radar', 'update')
  async runFullRadar(@Query('tenantId') tenantId: string) {
    const [health, anomalies, opportunities, alerts] = await Promise.all([
      this.radarService.runHealthCheck(tenantId),
      this.radarService.detectAnomalies(tenantId),
      this.radarService.identifyOpportunities(tenantId),
      this.radarService.generateAlerts(tenantId),
    ]);

    this.radarService['eventService'].emit('radar.completed', {
      tenantId,
      overall: health.overall,
      anomalyCount: anomalies.length,
      opportunityCount: opportunities.length,
      alertCount: alerts.length,
    });

    return { health, anomalies, opportunities, alerts, runAt: new Date().toISOString() };
  }
}
