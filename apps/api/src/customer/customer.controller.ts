/**
 * ZYRA — Customer Controller
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CustomerService, type CreateCustomerDto } from './customer.service';

@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get('tenant/:tenantId')
  @UseGuards(AuthGuard, RolesGuard)
  findByTenant(
    @Param('tenantId') tenantId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.customerService.findByTenant(tenantId, +page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customerService.findById(id);
  }

  @Get(':id/360')
  get360View(@Param('id') id: string) {
    return this.customerService.get360View(id);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  create(@Body() dto: CreateCustomerDto) {
    return this.customerService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  update(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.customerService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  delete(@Param('id') id: string) {
    return this.customerService.delete(id);
  }
}
