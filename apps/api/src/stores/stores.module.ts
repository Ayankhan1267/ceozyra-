/**
 * ZYRA — Stores Module
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
