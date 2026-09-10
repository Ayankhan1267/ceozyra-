/**
 * ZYRA — Discounts & Coupons Controller
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
import {
  ProductService,
  type CreateDiscountDto,
  type UpdateDiscountDto,
  type CreateCouponDto,
  type UpdateCouponDto,
} from './product.service';

@Controller('discounts')
export class DiscountsController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  list(@Query('tenantId') tenantId?: string, @Query('storefrontId') storefrontId?: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId query parameter is required');
    }
    return this.productService.getDiscounts(tenantId, storefrontId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  create(@Body() dto: CreateDiscountDto) {
    return this.productService.createDiscount(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateDiscountDto) {
    return this.productService.updateDiscount(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  delete(@Param('id') id: string) {
    return this.productService.deleteDiscount(id);
  }
}

@Controller('coupons')
export class CouponsController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  list(@Query('tenantId') tenantId: string) {
    return this.productService.getCoupons(tenantId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  create(@Body() dto: CreateCouponDto) {
    return this.productService.createCoupon(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.productService.updateCoupon(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  delete(@Param('id') id: string) {
    return this.productService.deleteCoupon(id);
  }

  @Get(':code/validate')
  validate(
    @Param('code') code: string,
    @Query('tenantId') tenantId: string,
    @Query('orderValue') orderValue?: string,
  ) {
    return this.productService.validateCoupon(
      code,
      tenantId,
      orderValue ? parseFloat(orderValue) : undefined,
    );
  }
}
