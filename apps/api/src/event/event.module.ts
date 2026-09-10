/**
 * ZYRA — Event Bus Module (in-process EventEmitter)
 */

import { Module } from '@nestjs/common';
import { EventBusService } from './event.service';

@Module({
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventModule {}
