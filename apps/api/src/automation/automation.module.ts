/**
 * ZYRA — Automation Module (Phase 4 Communications)
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';
import { RbacModule } from '../rbac/rbac.module';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';

@Module({
  imports: [DatabaseModule, EventModule, RbacModule],
  controllers: [AutomationController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
