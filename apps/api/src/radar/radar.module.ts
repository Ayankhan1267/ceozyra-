/**
 * ZYRA — Radar Module (Phase 7.1)
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';
import { RbacModule } from '../rbac/rbac.module';
import { RadarService } from './radar.service';
import { RadarController } from './radar.controller';

@Module({
  imports: [DatabaseModule, EventModule, RbacModule],
  controllers: [RadarController],
  providers: [RadarService],
  exports: [RadarService],
})
export class RadarModule {}
