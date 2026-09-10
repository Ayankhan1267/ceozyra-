/**
 * ZYRA — Discounts & Coupons Controller
 * CRUD + validation + stats endpoints.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Patch,
  Delete,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';
import { DiscountsService } from './discounts.service';
import type { DiscountType } from '@prisma/client';

@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  create(@Body() dto: Record<string, unknown>) {
    return this.discountsService.create(dto as any);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  list(
    @Query('tenantId') tenantId: string,
    @Query('isActive') isActive?: string,
    @Query('type') type?: DiscountType,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.discountsService.list({
      tenantId,
      isActive: isActive ? isActive === 'true' : undefined,
      type,
      search,
      page: +page,
      limit: +limit,
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.discountsService.findById(id, tenantId);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  update(@Param('id') id: string, @Query('tenantId') tenantId: string, @Body() dto: Record<string, unknown>) {
    return this.discountsService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  delete(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.discountsService.delete(id, tenantId);
  }

  @Post('validate')
  validate(@Body() dto: Record<string, unknown>) {
    return this.discountsService.validate(
      dto.code as string,
      dto.tenantId as string,
      dto.cart as any,
    );
  }

  @Get(':id/stats')
  @UseGuards(AuthGuard, RolesGuard)
  getStats(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.discountsService.getStats(id, tenantId);
  }
}
