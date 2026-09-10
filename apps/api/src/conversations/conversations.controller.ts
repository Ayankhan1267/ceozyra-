/**
 * ZYRA — Conversations Controller (Phase 4 Communications)
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('conversations', 'read')
  list(
    @Query('tenantId') tenantId: string,
    @Query('customerId') customerId?: string,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.conversationsService.list(tenantId, {
      customerId,
      channel,
      status,
      page: +page,
      limit: +limit,
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('conversations', 'read')
  findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.conversationsService.findById(id, tenantId);
  }

  @Get(':id/messages')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('conversations', 'read')
  getMessages(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.conversationsService.getMessages(id, tenantId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('conversations', 'create')
  create(@Query('tenantId') tenantId: string, @Body() dto: Record<string, unknown>) {
    return this.conversationsService.create(tenantId, dto as any);
  }

  @Post('get-or-create')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('conversations', 'create')
  getOrCreate(@Query('tenantId') tenantId: string, @Body() dto: Record<string, unknown>) {
    return this.conversationsService.getOrCreate(tenantId, dto as any);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('conversations', 'update')
  update(@Param('id') id: string, @Query('tenantId') tenantId: string, @Body() data: Record<string, unknown>) {
    return this.conversationsService.update(id, tenantId, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('conversations', 'delete')
  delete(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.conversationsService.delete(id, tenantId);
  }
}
