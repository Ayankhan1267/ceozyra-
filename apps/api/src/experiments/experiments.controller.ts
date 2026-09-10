/**
 * ZYRA — Experiments Controller (Phase 7.2)
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import { ExperimentsService } from './experiments.service';
import type { ExperimentStatus, ExperimentType } from '@prisma/client';

@Controller('experiments')
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  // ── CRUD ────────────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('experiments', 'create')
  create(@Query('tenantId') tenantId: string, @Body() dto: Record<string, unknown>) {
    return this.experimentsService.create(dto as any);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('experiments', 'read')
  list(
    @Query('tenantId') tenantId: string,
    @Query('status') status?: ExperimentStatus,
    @Query('type') type?: ExperimentType,
  ) {
    return this.experimentsService.list(tenantId, status, type);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('experiments', 'read')
  findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.experimentsService.findById(id, tenantId);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  @Post(':id/start')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('experiments', 'update')
  start(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.experimentsService.startExperiment(id, tenantId);
  }

  @Post(':id/stop')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('experiments', 'update')
  stop(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.experimentsService.stopExperiment(id, tenantId);
  }

  // ── Results ─────────────────────────────────────────────────────────────────

  @Post(':id/record')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('experiments', 'update')
  recordResult(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.experimentsService.recordResult(dto as any);
  }

  @Get(':id/results')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('experiments', 'read')
  getResults(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.experimentsService.getExperimentResults(id, tenantId);
  }

  @Get('stats/overview')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('experiments', 'read')
  getStats(@Query('tenantId') tenantId: string) {
    return this.experimentsService.getExperimentStats(tenantId);
  }
}
