/**
 * ZYRA — Conversations Module (Phase 4 Communications)
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';
import { RbacModule } from '../rbac/rbac.module';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';

@Module({
  imports: [DatabaseModule, EventModule, RbacModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
