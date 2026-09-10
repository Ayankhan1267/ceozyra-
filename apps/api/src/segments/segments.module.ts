/**
 * ZYRA — Segments Module (CRM Phase 3)
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';
import { RbacModule } from '../rbac/rbac.module';
import { SegmentsService } from './segments.service';
import { SegmentsController } from './segments.controller';

@Module({
  imports: [DatabaseModule, EventModule, RbacModule],
  controllers: [SegmentsController],
  providers: [SegmentsService],
  exports: [SegmentsService],
})
export class SegmentsModule {}
