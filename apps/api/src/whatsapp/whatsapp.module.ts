/**
 * ZYRA — WhatsApp Module
 *
 * Meta Graph API (v18.0) adapter for WhatsApp Business Platform.
 * Provides sendMessage, sendTemplateMessage, sendMediaMessage,
 * inbound webhook handling, and markAsRead.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';

import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';

@Module({
  imports: [DatabaseModule, QueueModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
