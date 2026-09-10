/**
 * ZYRA — SMS Controller
 * Routes: /sms/*
 */

import { Controller, Post, Body, Get, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { SmsService, type SendSmsInput, type SendOtpInput } from './sms.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermission } from '../rbac/permissions.decorator';

@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Post('send')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('communication', 'write')
  sendSMS(@Body() dto: SendSmsInput) {
    if (!dto.to || !dto.body) throw new BadRequestException('to and body are required.');
    return this.smsService.sendSMS(dto);
  }

  @Post('send-otp')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('communication', 'write')
  sendOTP(@Body() dto: SendOtpInput) {
    if (!dto.to) throw new BadRequestException('to is required.');
    return this.smsService.sendOTP(dto);
  }

  @Post('verify-otp')
  @UseGuards(AuthGuard, RolesGuard)
  verifyOTP(@Body() body: { phone: string; code: string; tenantId?: string }) {
    return this.smsService.verifyOTP(body.phone, body.code, body.tenantId);
  }

  @Post('bulk')
  @UseGuards(AuthGuard, RolesGuard)
  @RequirePermission('communication', 'write')
  sendBulk(
    @Body() body: { recipients: string[]; message: string; senderId?: string; tenantId?: string },
  ) {
    if (!body.recipients?.length || !body.message) {
      throw new BadRequestException('recipients and message are required.');
    }
    return this.smsService.sendBulkSMS(body.recipients, body.message, body.senderId, body.tenantId);
  }

  @Post('webhook/twilio')
  handleTwilioWebhook(@Body() payload: Record<string, unknown>) {
    return this.smsService.handleInboundWebhook(payload);
  }

  @Post('webhook/msg91')
  handleMSG91Webhook(@Body() payload: Record<string, unknown>) {
    return this.smsService.handleInboundWebhook(payload);
  }

  @Get('status/:messageId')
  @UseGuards(AuthGuard, RolesGuard)
  getStatus(@Param('messageId') messageId: string) {
    return this.smsService.getStatus(messageId);
  }
}
