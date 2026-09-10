/**
 * ZYRA — Activities Controller
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ActivitiesService } from './activities.service';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  findAll(@Query() query: Record<string, string | undefined>) {
    return this.activitiesService.findAll(query);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  create(@Body() dto: Record<string, unknown>, @Query('tenantId') tenantId: string) {
    return this.activitiesService.create({ ...dto, tenantId } as any);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>, @Query('tenantId') tenantId: string) {
    return this.activitiesService.update(id, dto, tenantId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  remove(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.activitiesService.remove(id, tenantId);
  }
}
