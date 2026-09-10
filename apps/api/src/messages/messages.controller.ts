/**
 * ZYRA — Messages Controller (Phase 4 Communications)
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import { MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('messages', 'read')
  list(@Query('conversationId') conversationId: string, @Query('tenantId') tenantId: string) {
    return this.messagesService.list(tenantId, conversationId);
  }

  @Get('conversation/:conversationId')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('messages', 'read')
  getByConversation(@Param('conversationId') conversationId: string, @Query('tenantId') tenantId: string) {
    return this.messagesService.getByConversation(conversationId, tenantId);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('messages', 'read')
  findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.messagesService.findById(id, tenantId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('messages', 'create')
  create(@Query('tenantId') tenantId: string, @Body() dto: Record<string, unknown>) {
    return this.messagesService.create(tenantId, dto as any);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('messages', 'update')
  updateStatus(@Param('id') id: string, @Query('tenantId') tenantId: string, @Body() dto: Record<string, unknown>) {
    return this.messagesService.updateStatus(id, tenantId, dto as any);
  }
}
