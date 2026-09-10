/**
 * ZYRA — Tags Controller
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TagsService } from './tags.service';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  findAll(@Query('tenantId') tenantId: string) {
    return this.tagsService.findAll(tenantId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  create(@Body() dto: Record<string, unknown>, @Query('tenantId') tenantId: string) {
    return this.tagsService.create({ ...dto, tenantId } as any);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>, @Query('tenantId') tenantId: string) {
    return this.tagsService.update(id, dto, tenantId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  remove(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.tagsService.remove(id, tenantId);
  }

  @Post('bulk')
  @UseGuards(AuthGuard, RolesGuard)
  bulkTag(@Body() body: { customerIds: string[]; tagNames: string[]; action: 'add' | 'remove' }, @Query('tenantId') tenantId: string) {
    return this.tagsService.bulkTag(tenantId, body.customerIds, body.tagNames, body.action);
  }
}
