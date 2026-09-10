/**
 * ZYRA — Stores Controller
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';
import {
  StoresService,
  CreateStoreDto,
  UpdateStoreDto,
  CreatePageDto,
  UpdatePageDto,
  CreateThemeDto,
} from './stores.service';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  findByTenant(@Query('tenantId') tenantId: string) {
    return this.storesService.findByTenant(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storesService.findById(id);
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.storesService.findBySlug(slug);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  create(@Body() dto: CreateStoreDto) {
    return this.storesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateStoreDto) {
    return this.storesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  delete(@Param('id') id: string) {
    return this.storesService.delete(id);
  }

  @Get(':storeId/pages')
  findPages(@Param('storeId') storeId: string) {
    return this.storesService.findPages(storeId);
  }

  @Post(':storeId/pages')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  createPage(@Param('storeId') storeId: string, @Body() dto: CreatePageDto) {
    return this.storesService.createPage(storeId, dto);
  }

  @Patch('pages/:pageId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  updatePage(@Param('storeId') storeId: string, @Param('pageId') pageId: string, @Body() dto: UpdatePageDto) {
    return this.storesService.updatePage(storeId, pageId, dto);
  }

  @Post('pages/:pageId/publish')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  publishPage(
    @Param('storeId') storeId: string,
    @Param('pageId') pageId: string,
    @Body() body: { published: boolean },
  ) {
    return this.storesService.publishPage(storeId, pageId, body.published);
  }

  @Get(':storeId/themes')
  findThemes(@Param('storeId') storeId: string) {
    return this.storesService.findThemes(storeId);
  }

  @Post(':storeId/themes')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  createTheme(@Param('storeId') storeId: string, @Body() dto: CreateThemeDto) {
    return this.storesService.createOrUpdateTheme(storeId, dto);
  }
}
