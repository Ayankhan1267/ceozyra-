/**
 * ZYRA — Tenant Controller
 */

import { Controller, Get, Post, Body, Param, UseGuards, Put, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';
import { TenantService } from './tenant.service';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.tenantService.findAll({ page: +page, limit: +limit });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantService.findById(id);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  create(@Body() data: { name: string; slug: string; domain?: string; customDomain?: string }) {
    return this.tenantService.create(data);
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  update(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.tenantService.update(id, data);
  }
}
