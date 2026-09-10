/**
 * ZYRA — Agent Module (AI Core)
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';

@Module({
  imports: [DatabaseModule, QueueModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
