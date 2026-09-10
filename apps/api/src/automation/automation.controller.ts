/**
 * ZYRA — Automation Controller (Phase 4 Communications)
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import { AutomationService } from './automation.service';

@Controller('automation')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('automation', 'read')
  list(
    @Query('tenantId') tenantId: string,
    @Query('triggerType') triggerType?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.automationService.list(tenantId, {
      triggerType,
      isActive: isActive ? isActive === 'true' : undefined,
      page: +page,
      limit: +limit,
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('automation', 'read')
  findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.automationService.findById(id, tenantId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('automation', 'create')
  create(@Query('tenantId') tenantId: string, @Body() data: Record<string, unknown>) {
    return this.automationService.create(tenantId, data);
  }

  @Post(':id/trigger')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('automation', 'update')
  trigger(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.automationService.trigger(id, tenantId);
  }

  @Post(':id/toggle')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('automation', 'update')
  toggle(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.automationService.toggle(id, tenantId);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('automation', 'update')
  update(@Param('id') id: string, @Query('tenantId') tenantId: string, @Body() data: Record<string, unknown>) {
    return this.automationService.update(id, tenantId, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('automation', 'delete')
  delete(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.automationService.delete(id, tenantId);
  }
}
