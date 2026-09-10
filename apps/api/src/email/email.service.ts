/**
 * ZYRA — Email Service
 *
 * Nodemailer-based email service with SMTP configuration per-tenant.
 * Falls back to platform default SMTP when no tenant override is set.
 * Emails are queued through the QueueService (in-memory / BullMQ) for reliability.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter, SendMailOptions } from 'nodemailer';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../database/prisma.service';
import { EmailSettingsService } from './email-settings.service';
import { renderTemplate, templateList, type TemplateName } from './email.templates';

// ─── Types ────────────────────────────────────────────────────

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName?: string;
}

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text: string;
  tenantId?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
  }>;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailJobData['attachments'];
  tenantId?: string;
}

// ─── Service ─────────────────────────────────────────────────

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private platformTransporter: Transporter | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly emailSettingsService: EmailSettingsService,
    private readonly prisma: PrismaService,
  ) {
    this.initTransporter();
  }

  private initTransporter(): void {
    const cfg = this.getPlatformSmtpConfig();
    if (!cfg) {
      this.logger.warn(
        'No SMTP configuration found — emails will be queued but not sent until SMTP_HOST is set.',
      );
      return;
    }

    this.platformTransporter = createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
      tls: { rejectUnauthorized: false },
    });

    this.logger.log(`SMTP transporter initialised: ${cfg.host}:${cfg.port}`);
  }

  private getPlatformSmtpConfig(): Partial<SmtpConfig> | null {
    const host = process.env.SMTP_HOST;
    if (!host) return null;

    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    const from = process.env.EMAIL_FROM || 'noreply@ceozyra.com';

    return { host, port, secure, user, pass, from };
  }

  private async resolveSmtpConfig(tenantId?: string): Promise<SmtpConfig | null> {
    if (tenantId) {
      const tenantCfg = await this.emailSettingsService.getSmtpConfigForTenant(tenantId);
      if (tenantCfg) return tenantCfg;
    }

    const cfg = this.getPlatformSmtpConfig();
    if (!cfg) return null;

    return cfg as SmtpConfig;
  }

  async sendEmail(input: SendEmailInput): Promise<{ queued: true; jobId: string }> {
    const jobData: EmailJobData = {
      to: input.to,
      subject: input.subject,
      html: input.html || '',
      text: input.text || stripHtml(input.html || ''),
      replyTo: input.replyTo,
      attachments: input.attachments,
      tenantId: input.tenantId,
    };

    const job = await this.queueService.addEmailJob('send-email', jobData as unknown as Record<string, unknown>);
    this.logger.debug(`Email queued (${job.id}): to=${input.to}, subject="${input.subject}"`);
    return { queued: true, jobId: job.id };
  }

  async sendTemplate(
    template: TemplateName,
    to: string,
    data: Record<string, string>,
    tenantId?: string,
  ): Promise<{ queued: true; jobId: string }> {
    const rendered = renderTemplate(template, data);
    return this.sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tenantId,
    });
  }

  // ─── Convenience methods ───────────────────────────────────

  async sendWelcome(to: string, name: string, loginUrl: string, tenantId?: string) {
    return this.sendTemplate('welcome', to, { name, loginUrl }, tenantId);
  }

  async sendPasswordReset(to: string, name: string, resetUrl: string, tenantId?: string) {
    return this.sendTemplate('password-reset', to, { name, resetUrl }, tenantId);
  }

  async sendOrderConfirmation(
    to: string,
    name: string,
    orderId: string,
    total: string,
    date: string,
    items: string,
    orderUrl: string,
    tenantId?: string,
  ) {
    return this.sendTemplate(
      'order-confirmation',
      to,
      { name, orderId, total, date, items, orderUrl },
      tenantId,
    );
  }

  async sendInvoice(
    to: string,
    name: string,
    invoiceId: string,
    orderId: string,
    total: string,
    date: string,
    invoiceUrl: string,
    tenantId?: string,
  ) {
    return this.sendTemplate(
      'invoice',
      to,
      { name, invoiceId, orderId, total, date, invoiceUrl },
      tenantId,
    );
  }

  async sendOtp(to: string, otp: string, name?: string, tenantId?: string) {
    return this.sendTemplate('otp', to, { otp, name: name || 'there' }, tenantId);
  }

  // ─── Process the next email job via SMTP ───────────────────
  async processEmailJob(jobData: EmailJobData): Promise<{ success: boolean; message: string }> {
    const smtpConfig = await this.resolveSmtpConfig(jobData.tenantId);
    if (!smtpConfig) {
      this.logger.warn(`SMTP not configured — email to ${jobData.to} could not be sent.`);
      return { success: false, message: 'SMTP not configured' };
    }

    const from = `${smtpConfig.fromName || 'ZYRA'} <${smtpConfig.from}>`;
    this.trackEmail(jobData, from, 'PENDING');

    const transporter = createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: { user: smtpConfig.user, pass: smtpConfig.pass },
      tls: { rejectUnauthorized: false },
    });

    try {
      const mailOptions: SendMailOptions = {
        from,
        to: jobData.to,
        subject: jobData.subject,
        html: jobData.html,
        text: jobData.text,
        replyTo: jobData.replyTo,
      };

      if (jobData.attachments && jobData.attachments.length > 0) {
        mailOptions.attachments = jobData.attachments.map((a) => ({
          filename: a.filename,
          content: a.content || a.path,
        }));
      }

      const result = await transporter.sendMail(mailOptions);
      this.trackEmail(jobData, from, 'SENT', result.messageId);
      this.logger.log(`Email sent to ${jobData.to} (messageId: ${result.messageId})`);
      return { success: true, message: `Sent (${result.messageId})` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown SMTP error';
      this.trackEmail(jobData, from, 'FAILED', undefined, msg);
      this.logger.error(`Failed to send email to ${jobData.to}: ${msg}`);
      throw err;
    }
  }

  private async trackEmail(
    jobData: EmailJobData,
    from: string,
    status: 'PENDING' | 'SENT' | 'FAILED',
    externalId?: string,
    error?: string,
  ): Promise<void> {
    try {
      if (status === 'PENDING' && jobData.tenantId) {
        await this.prisma.emailMessage.create({
          data: {
            tenantId: jobData.tenantId,
            to: jobData.to,
            subject: jobData.subject,
            body: jobData.html || jobData.text,
            status,
          },
        });
        return;
      }
      if (status === 'SENT' || status === 'FAILED') {
        await this.prisma.emailMessage.updateMany({
          where: {
            tenantId: jobData.tenantId ?? '',
            to: jobData.to,
            subject: jobData.subject,
            status: 'PENDING',
          },
          data: {
            status: status === 'SENT' ? 'SENT' : 'FAILED',
            externalId: externalId ?? null,
            error: error ?? null,
            sentAt: status === 'SENT' ? new Date() : undefined,
          },
        });
      }
    } catch (trackErr) {
      this.logger.debug(`Email tracking skipped: ${trackErr instanceof Error ? trackErr.message : String(trackErr)}`);
    }
  }

  async verifyConnection(): Promise<boolean> {
    const smtpConfig = await this.resolveSmtpConfig();
    if (!smtpConfig) return false;

    try {
      const transporter = createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: { user: smtpConfig.user, pass: smtpConfig.pass },
      });
      await transporter.verify();
      this.logger.log('SMTP connection verified successfully.');
      return true;
    } catch (err) {
      this.logger.error(
        `SMTP connection failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  getAvailableTemplates() {
    return templateList;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
