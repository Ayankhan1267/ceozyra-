/**
 * ZYRA — Categories Controller
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';
import { ProductService } from '../product/product.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  list(@Query('storefrontId') storefrontId?: string) {
    if (!storefrontId) return [];
    return this.productService.listCategories(storefrontId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  create(@Body() data: { storefrontId: string; name: string; slug: string; description?: string; image?: string }) {
    return this.productService.createCategory(data);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  update(@Param('id') id: string, @Body() data: { name?: string; slug?: string; image?: string }) {
    return this.productService.updateCategory(id, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  delete(@Param('id') id: string) {
    return this.productService.deleteCategory(id);
  }
}
