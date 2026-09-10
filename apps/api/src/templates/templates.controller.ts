/**
 * ZYRA — Templates Controller (Phase 4 Communications)
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import { TemplatesService } from './templates.service';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('templates', 'read')
  list(@Query('tenantId') tenantId: string) {
    return this.templatesService.list(tenantId);
  }

  @Get('type/:type')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('templates', 'read')
  getByType(@Query('tenantId') tenantId: string, @Param('type') type: string) {
    return this.templatesService.getByType(tenantId, type);
  }

  @Get('default/:type')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('templates', 'read')
  getDefault(@Query('tenantId') tenantId: string, @Param('type') type: string) {
    return this.templatesService.getDefault(tenantId, type);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('templates', 'read')
  findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.templatesService.findById(id, tenantId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('templates', 'create')
  create(@Query('tenantId') tenantId: string, @Body() dto: Record<string, unknown>) {
    return this.templatesService.create(tenantId, dto as any);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('templates', 'update')
  update(@Param('id') id: string, @Query('tenantId') tenantId: string, @Body() data: Record<string, unknown>) {
    return this.templatesService.update(id, tenantId, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('templates', 'delete')
  delete(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.templatesService.delete(id, tenantId);
  }
}
