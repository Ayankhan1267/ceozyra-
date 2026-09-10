/**
 * ZYRA — Experiments Module (Phase 7.2)
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';
import { RbacModule } from '../rbac/rbac.module';
import { ExperimentsService } from './experiments.service';
import { ExperimentsController } from './experiments.controller';

@Module({
  imports: [DatabaseModule, EventModule, RbacModule],
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
