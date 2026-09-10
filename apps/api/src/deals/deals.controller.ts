/**
 * ZYRA — Deals Controller
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { DealsService } from './deals.service';

@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  findAll(@Query() query: Record<string, string | undefined>) {
    return this.dealsService.findAll(query);
  }

  @Get('stats')
  @UseGuards(AuthGuard, RolesGuard)
  getStats(@Query('tenantId') tenantId: string) {
    return this.dealsService.getStats(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.dealsService.findById(id, tenantId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  create(@Body() dto: Record<string, unknown>, @Query('tenantId') tenantId: string) {
    return this.dealsService.create({ ...dto, tenantId } as any);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>, @Query('tenantId') tenantId: string) {
    return this.dealsService.update(id, dto, tenantId);
  }

  @Patch(':id/move')
  @UseGuards(AuthGuard, RolesGuard)
  move(@Param('id') id: string, @Body() body: { stageId: string }, @Query('tenantId') tenantId: string) {
    return this.dealsService.move(id, body.stageId, tenantId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  remove(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.dealsService.remove(id, tenantId);
  }
}
