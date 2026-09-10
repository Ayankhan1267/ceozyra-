/**
 * ZYRA — SMS Module
 *
 * Provider abstraction for SMS delivery via Twilio or MSG91.
 * Provider selected by SMS_PROVIDER env var ("twilio" | "msg91").
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';

import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';

@Module({
  imports: [DatabaseModule, QueueModule],
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
