/**
 * ZYRA — Pipeline Module
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PipelineService } from './pipeline.service';
import { PipelineController } from './pipeline.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [PipelineController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
