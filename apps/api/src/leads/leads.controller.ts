import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  list(
    @Query('tenantId') tenantId: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.leadsService.list(tenantId, { status, source, assignedTo, search, page: +page, limit: +limit });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.leadsService.findById(id, tenantId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  create(@Query('tenantId') tenantId: string, @Body() dto: Record<string, unknown>) {
    return this.leadsService.create(tenantId, dto as any);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  update(@Param('id') id: string, @Query('tenantId') tenantId: string, @Body() data: Record<string, unknown>) {
    return this.leadsService.update(id, tenantId, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  delete(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.leadsService.delete(id, tenantId);
  }

  @Post(':id/convert')
  @UseGuards(AuthGuard, RolesGuard)
  convertToCustomer(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.leadsService.convertToCustomer(id, tenantId);
  }

  @Post(':id/assign')
  @UseGuards(AuthGuard, RolesGuard)
  assign(@Param('id') id: string, @Query('tenantId') tenantId: string, @Body() dto: { userId: string }) {
    return this.leadsService.assign(id, tenantId, dto);
  }

  @Post('bulk-import')
  @UseGuards(AuthGuard, RolesGuard)
  bulkImport(@Query('tenantId') tenantId: string, @Body() body: { csv: string }) {
    return this.leadsService.bulkImport(tenantId, body.csv);
  }

  @Get('stats')
  @UseGuards(AuthGuard, RolesGuard)
  getStats(@Query('tenantId') tenantId: string) {
    return this.leadsService.getStats(tenantId);
  }
}
