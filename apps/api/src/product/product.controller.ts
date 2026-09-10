/**
 * ZYRA — Product Controller
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';
import { ProductService, type CreateProductDto } from './product.service';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('storefront/:storefrontId')
  findByStorefront(
    @Param('storefrontId') storefrontId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('categoryId') categoryId?: string,
  ) {
    return this.productService.findByStorefront(storefrontId, { page: +page, limit: +limit, categoryId });
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE')
  findByTenant(@Query('tenantId') tenantId: string, @Query('page') page = '1', @Query('limit') limit = '20') {
    return this.productService.findByTenant(tenantId, +page, +limit);
  }

  @Get('search')
  search(
    @Query('q') q: string,
    @Query('tenantId') tenantId?: string,
    @Query('storefrontId') storefrontId?: string,
  ) {
    return this.productService.search(q, tenantId, storefrontId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findById(id);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.productService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  delete(@Param('id') id: string) {
    return this.productService.delete(id);
  }

  @Get('filter')
  filter(
    @Query('tenantId') tenantId?: string,
    @Query('storefrontId') storefrontId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    return this.productService.listProducts({
      tenantId,
      storefrontId,
      page: +page,
      limit: +limit,
      categoryId,
      search,
    });
  }

  @Get(':id/variants')
  async listVariants(@Param('id') id: string) {
    return this.productService['prisma'].productVariant.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post(':id/variants')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  createVariant(@Param('id') productId: string, @Body() dto: Record<string, unknown>) {
    return this.productService.createVariant(productId, dto as any);
  }

  @Delete(':productId/variants/:variantId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  deleteVariant(@Param('productId') productId: string, @Param('variantId') variantId: string) {
    return this.productService['prisma'].productVariant.delete({
      where: { id: variantId },
    });
  }

  @Delete(':id/images/:index')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  async deleteImage(@Param('id') id: string, @Param('index') index: string) {
    const product = await this.productService['prisma'].product.findUnique({
      where: { id },
      select: { images: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const idx = parseInt(index, 10);
    const updated = product.images.filter((_, i) => i !== idx);

    return this.productService['prisma'].product.update({
      where: { id },
      data: { images: updated },
    });
  }
}
