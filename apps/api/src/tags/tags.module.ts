/**
 * ZYRA — Tags Module
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TagsService } from './tags.service';
import { TagsController } from './tags.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
