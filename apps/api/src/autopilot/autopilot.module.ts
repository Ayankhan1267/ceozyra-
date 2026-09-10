/**
 * ZYRA — Autopilot Module (Phase 8)
 *
 * Autonomous business optimization with controllable autonomy levels.
 * Depends on Database, Event, Agent, and Queue modules.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';
import { AgentModule } from '../agent/agent.module';
import { QueueModule } from '../queue/queue.module';

// Services
import { AutopilotService } from './autopilot.service';
import { PoliciesService } from './policies.service';

@Module({
  imports: [DatabaseModule, EventModule, AgentModule, QueueModule],
  controllers: [],
  providers: [AutopilotService, PoliciesService],
  exports: [AutopilotService],
})
export class AutopilotModule {}
