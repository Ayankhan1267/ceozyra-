/**
 * ZYRA — Sales Module (Phase 3.3)
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';
import { LeadsModule } from '../leads/leads.module';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';

@Module({
  imports: [DatabaseModule, EventModule, LeadsModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
