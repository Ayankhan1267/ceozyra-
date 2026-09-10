/**
 * ZYRA — Communication Module (WhatsApp, Email, SMS)
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { CommunicationService } from './communication.service';
import { CommunicationController } from './communication.controller';

@Module({
  imports: [DatabaseModule, QueueModule],
  controllers: [CommunicationController],
  providers: [CommunicationService],
  exports: [CommunicationService],
})
export class CommunicationModule {}
