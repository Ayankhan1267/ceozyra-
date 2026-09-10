/**
 * ZYRA — Storefront Controller
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';
import { StorefrontService, type CreateStorefrontDto } from './storefront.service';

@Controller('storefronts')
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Get('slug/:slug')
  getBySlug(@Param('slug') slug: string) {
    return this.storefrontService.getStorefrontData(slug);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  findByTenant(@Query('tenantId') tenantId: string) {
    return this.storefrontService.findByTenant(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storefrontService.findById(id);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  create(@Body() dto: CreateStorefrontDto) {
    return this.storefrontService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  update(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.storefrontService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  delete(@Param('id') id: string) {
    return this.storefrontService.delete(id);
  }
}
