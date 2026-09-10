/**
 * ZYRA — Communication Module (WhatsApp, Email, SMS)
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

import { CommunicationService } from './communication.service';
import { CommunicationController } from './communication.controller';

@Module({
  imports: [DatabaseModule, QueueModule, WhatsAppModule],
  controllers: [CommunicationController],
  providers: [CommunicationService],
  exports: [CommunicationService],
})
export class CommunicationModule {}
