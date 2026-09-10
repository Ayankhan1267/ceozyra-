/**
 * ZYRA — Email Module
 *
 * Provides email sending via Nodemailer, backed by BullMQ for
 * async delivery. Ships with five HTML templates: welcome,
 * password-reset, order-confirmation, invoice, and otp.
 *
 * Also exports EmailService for use by other modules (e.g.
 * communication.service) so they can queue emails without
 * depending on SMTP internals.
 *
 * Phase 0.13 — Email Infrastructure
 */

import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { DatabaseModule } from '../database/database.module';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { EmailSettingsService } from './email-settings.service';
import { EmailSettingsController } from './email-settings.controller';

@Module({
  imports: [QueueModule, DatabaseModule],
  controllers: [EmailController, EmailSettingsController],
  providers: [EmailService, EmailSettingsService],
  exports: [EmailService, EmailSettingsService],
})
export class EmailModule {}
