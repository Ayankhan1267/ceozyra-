/**
 * ZYRA — WhatsApp Controller
 * Routes: /whatsapp/*
 *
 * Meta webhook challenge (GET /whatsapp/webhook) is intentionally unauthenticated
 * so Meta can reach it. All other routes require auth + communication.write permission.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { WhatsAppService, type SendMessageInput, type SendTemplateInput, type SendMediaInput } from './whatsapp.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermission } from '../rbac/permissions.decorator';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  // ─── Send ──────────────────────────────────────────────────────────────────

  @Post('send')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('communication', 'write')
  sendMessage(@Body() dto: SendMessageInput) {
    if (!dto.to || !dto.message) {
      throw new BadRequestException('to and message are required.');
    }
    return this.whatsappService.sendMessage(dto);
  }

  @Post('send-template')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('communication', 'write')
  sendTemplateMessage(@Body() dto: SendTemplateInput) {
    if (!dto.to || !dto.templateName) {
      throw new BadRequestException('to and templateName are required.');
    }
    return this.whatsappService.sendTemplateMessage(dto);
  }

  @Post('send-media')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('communication', 'write')
  sendMediaMessage(@Body() dto: SendMediaInput) {
    if (!dto.to || !dto.mediaUrl || !dto.type) {
      throw new BadRequestException('to, mediaUrl, and type are required.');
    }
    return this.whatsappService.sendMediaMessage(dto);
  }

  // ─── Mark as Read ──────────────────────────────────────────────────────────

  @Post('mark-read')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('communication', 'write')
  markAsRead(@Body() body: { messageId: string }) {
    if (!body.messageId) {
      throw new BadRequestException('messageId is required.');
    }
    return this.whatsappService.markAsRead(body.messageId);
  }

  // ─── Inbound Webhook (no auth — Meta calls this directly) ──────────────────

  @Post('webhook')
  handleInbound(@Body() payload: Record<string, unknown>) {
    return this.whatsappService.handleInboundWebhook(payload);
  }

  // Meta GET challenge — verify the webhook URL during setup
  @Get('webhook')
  verifyWebhook(@Query() query: Record<string, string>) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return challenge;
    }

    throw new BadRequestException('Webhook verification failed.');
  }
}
