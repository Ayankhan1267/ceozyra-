import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';
import { ProductService } from '../product/product.service';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  list(@Query('storefrontId') storefrontId?: string) {
    if (!storefrontId) return [];
    return this.productService.listCollections(storefrontId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  create(@Body() data: Record<string, unknown>) {
    return this.productService.createCollection(data as any);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  update(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.productService.updateCollection(id, data as any);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  delete(@Param('id') id: string) {
    return this.productService.deleteCollection(id);
  }
}
