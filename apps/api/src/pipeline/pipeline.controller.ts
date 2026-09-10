/**
 * ZYRA — Pipeline Controller
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PipelineService } from './pipeline.service';

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  findAll(@Query('tenantId') tenantId: string) {
    return this.pipelineService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.pipelineService.findById(id, tenantId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  create(@Body() dto: Record<string, unknown>, @Query('tenantId') tenantId: string) {
    return this.pipelineService.create({ ...dto, tenantId } as any);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>, @Query('tenantId') tenantId: string) {
    return this.pipelineService.update(id, dto, tenantId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  remove(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.pipelineService.remove(id, tenantId);
  }
}
