import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SegmentsService } from './segments.service';

@Controller('segments')
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  findAll(@Query('tenantId') tenantId: string) {
    return this.segmentsService.list(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.segmentsService.findById(id, tenantId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  create(@Query('tenantId') tenantId: string, @Body() dto: Record<string, unknown>) {
    return this.segmentsService.create(tenantId, dto as any);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  update(@Param('id') id: string, @Query('tenantId') tenantId: string, @Body() data: Record<string, unknown>) {
    return this.segmentsService.update(id, tenantId, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  remove(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.segmentsService.delete(id, tenantId);
  }

  @Post(':id/evaluate')
  @UseGuards(AuthGuard, RolesGuard)
  evaluate(@Param('id') id: string, @Query('tenantId') tenantId: string, @Body() _dto: Record<string, unknown>) {
    return this.segmentsService.evaluate(id, tenantId, _dto as any);
  }
}
