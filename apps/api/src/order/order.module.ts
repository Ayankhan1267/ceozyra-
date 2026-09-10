/**
 * ZYRA — Order Module
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';

@Module({
  imports: [DatabaseModule, EventModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
