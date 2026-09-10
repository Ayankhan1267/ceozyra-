/**
 * ZYRA — Campaigns Controller (Phase 4 Communications)
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import { CampaignsService } from './campaigns.service';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('campaigns', 'read')
  list(
    @Query('tenantId') tenantId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.campaignsService.list(tenantId, { type, status, page: +page, limit: +limit });
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('campaigns', 'read')
  findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.campaignsService.findById(id, tenantId);
  }

  @Get(':id/stats')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('campaigns', 'read')
  getStats(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.campaignsService.getStats(id, tenantId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('campaigns', 'create')
  create(@Query('tenantId') tenantId: string, @Body() data: Record<string, unknown>) {
    return this.campaignsService.create(tenantId, data);
  }

  @Post(':id/start')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('campaigns', 'update')
  start(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.campaignsService.start(id, tenantId);
  }

  @Post(':id/pause')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('campaigns', 'update')
  pause(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.campaignsService.pause(id, tenantId);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('campaigns', 'update')
  update(@Param('id') id: string, @Query('tenantId') tenantId: string, @Body() data: Record<string, unknown>) {
    return this.campaignsService.update(id, tenantId, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('campaigns', 'delete')
  delete(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.campaignsService.delete(id, tenantId);
  }
}
