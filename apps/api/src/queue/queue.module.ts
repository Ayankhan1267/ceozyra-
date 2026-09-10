/**
 * ZYRA — Queue Module (Phase 0.3, BullMQ-backed)
 */

import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueProcessorService } from './queue-processor.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [QueueService, QueueProcessorService],
  exports: [QueueService, QueueProcessorService],
})
export class QueueModule {}
