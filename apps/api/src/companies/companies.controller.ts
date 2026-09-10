/**
 * ZYRA — Companies Controller (CRM Phase 3)
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import { CompaniesService, type CreateCompanyDto } from './companies.service';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('crm', 'read')
  list(
    @Query('tenantId') tenantId: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.companiesService.list(tenantId, {
      search,
      page: +page,
      limit: +limit,
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('crm', 'read')
  findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.companiesService.findById(id, tenantId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('crm', 'create')
  create(@Query('tenantId') tenantId: string, @Body() dto: CreateCompanyDto) {
    return this.companiesService.create(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('crm', 'update')
  update(@Param('id') id: string, @Query('tenantId') tenantId: string, @Body() data: Record<string, unknown>) {
    return this.companiesService.update(id, tenantId, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('crm', 'delete')
  delete(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.companiesService.delete(id, tenantId);
  }
}
