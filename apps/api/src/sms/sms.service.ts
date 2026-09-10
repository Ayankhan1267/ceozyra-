/**
 * ZYRA — SMS Service
 *
 * Provider abstraction for SMS delivery via Twilio or MSG91.
 * Provider selected by SMS_PROVIDER env var ("twilio" | "msg91").
 * Records every message in the sms_messages table.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SendSmsInput {
  to: string;
  body: string;
  tenantId?: string;
  senderId?: string;
}

export interface SendOtpInput {
  to: string;
  tenantId?: string;
  otpCode: string;
  expiresInMinutes?: number;
}

export interface SmsStatusResult {
  id: string;
  status: string;
  externalId: string | null;
  error: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
}

export interface BulkSmsResult {
  total: number;
  sent: number;
  failed: number;
  results: Array<{ phone: string; status: string; messageId?: string; error?: string }>;
}

// ─── Provider Interfaces ────────────────────────────────────────────────────

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

interface MSG91Config {
  authKey: string;
  senderId: string;
  route: string;
}

// ─── Service ────────────────────────────────────────────────────────────────

type SmsProvider = 'twilio' | 'msg91';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: SmsProvider;

  private twilioConfig: TwilioConfig | null = null;
  private msg91Config: MSG91Config | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {
    this.provider = (process.env.SMS_PROVIDER as SmsProvider) ?? 'twilio';
    this.loadConfigs();
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  async sendSMS(input: SendSmsInput): Promise<SmsStatusResult> {
    const { to, body, senderId, tenantId } = input;

    // Normalise phone number (ensure E.164 format)
    const toE164 = this.normalisePhone(to);

    let externalId: string | undefined;
    let sendError: string | undefined;

    try {
      if (this.provider === 'twilio') {
        const result = await this._sendViaTwilio(toE164, body, senderId);
        externalId = result.sid;
      } else {
        const result = await this._sendViaMSG91(toE164, body, senderId);
        externalId = result.messageId;
      }
    } catch (err) {
      sendError = err instanceof Error ? err.message : 'Unknown SMS provider error';
      this.logger.error(`SMS send failed to ${toE164}: ${sendError}`);
    }

    const record = await this.prisma.sMSMessage.create({
      data: {
        tenantId: tenantId ?? 'platform',
        to: toE164,
        body,
        status: sendError ? 'FAILED' : 'SENT',
        externalId,
        error: sendError ?? null,
        sentAt: sendError ? null : new Date(),
      },
    });

    return this.toStatusResult(record);
  }

  async sendOTP(input: SendOtpInput): Promise<SmsStatusResult> {
    const { to, tenantId, otpCode, expiresInMinutes = 10 } = this._normaliseOtpInput(input);

    const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000);
    const body = `Your ZYRA verification code is ${otpCode}. Valid for ${expiresInMinutes} minutes.`;

    // Persist OTP in the database (so it can be verified server-side)
    await this.prisma.otpCode.create({
      data: {
        tenantId: tenantId ?? 'platform',
        phone: this.normalisePhone(to),
        code: otpCode,
        expiresAt,
      },
    });

    return this.sendSMS({ to, body, tenantId, senderId: this.msg91Config?.senderId });
  }

  async verifyOTP(phone: string, code: string, tenantId?: string): Promise<{ valid: boolean; message: string }> {
    const normalisedPhone = this.normalisePhone(phone);
    const storedTenantId = tenantId ?? 'platform';

    const otp = await this.prisma.otpCode.findFirst({
      where: { phone: normalisedPhone, tenantId: storedTenantId, verified: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      return { valid: false, message: 'No OTP found for this phone number.' };
    }

    if (otp.expiresAt < new Date()) {
      return { valid: false, message: 'OTP has expired. Please request a new one.' };
    }

    if (otp.code !== code) {
      return { valid: false, message: 'Invalid OTP code.' };
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { verified: true, verifiedAt: new Date() },
    });

    return { valid: true, message: 'OTP verified successfully.' };
  }

  async sendBulkSMS(
    recipients: string[],
    message: string,
    senderId?: string,
    tenantId?: string,
  ): Promise<BulkSmsResult> {
    const results: BulkSmsResult['results'] = [];
    let sent = 0;
    let failed = 0;

    await Promise.all(
      recipients.map(async (phone) => {
        try {
          const result = await this.sendSMS({ to: phone, body: message, senderId, tenantId });
          results.push({ phone, status: result.status, messageId: result.id });
          if (result.status === 'SENT') sent++;
          else failed++;
        } catch {
          results.push({ phone, status: 'FAILED', error: 'Unhandled error' });
          failed++;
        }
      }),
    );

    return { total: recipients.length, sent, failed, results };
  }

  async handleInboundWebhook(payload: Record<string, unknown>): Promise<SmsStatusResult | null> {
    try {
      if (this.provider === 'twilio') {
        return this._handleTwilioWebhook(payload);
      }
      return this._handleMSG91Webhook(payload);
    } catch (err) {
      this.logger.error(`Webhook handling failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  async getStatus(messageId: string): Promise<SmsStatusResult | null> {
    const record = await this.prisma.sMSMessage.findUnique({ where: { id: messageId } });
    if (!record) return null;
    return this.toStatusResult(record);
  }

  // ─── Private: Provider Implementations ───────────────────────────────────

  private async _sendViaTwilio(to: string, body: string, senderId?: string): Promise<{ sid: string }> {
    if (!this.twilioConfig) throw new Error('Twilio is not configured.');

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioConfig.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.twilioConfig.accountSid}:${this.twilioConfig.authToken}`).toString('base64');
    const from = senderId ?? this.twilioConfig.fromNumber;

    const params = new URLSearchParams({ To: to, From: from, Body: body });

    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Twilio error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as { sid: string; status: string };
    return { sid: data.sid };
  }

  private async _sendViaMSG91(to: string, body: string, senderId?: string): Promise<{ messageId: string }> {
    if (!this.msg91Config) throw new Error('MSG91 is not configured.');

    const url = 'https://control.msg91.com/api/v5/flow/';
    const from = senderId ?? this.msg91Config.senderId;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authkey: this.msg91Config.authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: from,
        route: this.msg91Config.route,
        sms: [{ message: body, to: [this.stripE164(to)] }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`MSG91 error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as { id?: string; type?: string };
    const messageId = data.id ?? `msg91_${Date.now()}`;
    return { messageId };
  }

  // ─── Private: Webhook Handlers ───────────────────────────────────────────

  private async _handleTwilioWebhook(payload: Record<string, unknown>): Promise<SmsStatusResult | null> {
    const messageSid = payload.MessageSid as string | undefined;
    const messageStatus = payload.MessageStatus as string | undefined;
    const errorCode = payload.ErrorCode as string | undefined;
    const errorMessage = payload.ErrorMessage as string | undefined;

    if (!messageSid) return null;

    const record = await this.prisma.sMSMessage.findFirst({
      where: { externalId: messageSid },
    });

    if (!record) return null;

    const statusMap: Record<string, string> = {
      queued: 'QUEUED',
      sending: 'SENDING',
      sent: 'SENT',
      delivered: 'DELIVERED',
      undelivered: 'FAILED',
      failed: 'FAILED',
    };

    const update: Record<string, unknown> = {
      status: statusMap[messageStatus ?? ''] ?? 'SENT',
    };

    if (errorCode || errorMessage) {
      update.error = `${errorCode}: ${errorMessage}`;
    }

    if (messageStatus === 'delivered') {
      update.deliveredAt = new Date();
    }

    await this.prisma.sMSMessage.update({ where: { id: record.id }, data: update });
    return this.toStatusResult(await this.prisma.sMSMessage.findUnique({ where: { id: record.id } })!);
  }

  private async _handleMSG91Webhook(_payload: Record<string, unknown>): Promise<SmsStatusResult | null> {
    // MSG91 webhook format varies — adapt as needed.
    // For now, log and return null (MSG91 doesn't require webhook processing for basic delivery).
    this.logger.log('MSG91 webhook received (no-op processing).');
    return null;
  }

  // ─── Private: Helpers ────────────────────────────────────────────────────

  private loadConfigs(): void {
    // Twilio config
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioConfig = {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_FROM_NUMBER ?? '',
      };
    }

    // MSG91 config
    if (process.env.MSG91_AUTH_KEY) {
      this.msg91Config = {
        authKey: process.env.MSG91_AUTH_KEY,
        senderId: process.env.MSG91_SENDER_ID ?? 'ZYRAAP',
        route: process.env.MSG91_ROUTE ?? '4',
      };
    }
  }

  private normalisePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
    if (!digits.startsWith('+')) return `+${digits}`;
    return digits;
  }

  private stripE164(phone: string): string {
    return phone.replace(/^\+/, '');
  }

  private _normaliseOtpInput(input: SendOtpInput): Required<Omit<SendOtpInput, 'otpCode'>> & { otpCode: string } {
    return {
      to: input.to,
      tenantId: input.tenantId ?? 'platform',
      otpCode: input.otpCode,
      expiresInMinutes: input.expiresInMinutes ?? 10,
    };
  }

  private toStatusResult(record: { id: string; status: string; externalId: string | null; error: string | null; sentAt: Date | null; deliveredAt: Date | null }): SmsStatusResult {
    return {
      id: record.id,
      status: record.status,
      externalId: record.externalId,
      error: record.error,
      sentAt: record.sentAt?.toISOString() ?? null,
      deliveredAt: record.deliveredAt?.toISOString() ?? null,
    };
  }
}
