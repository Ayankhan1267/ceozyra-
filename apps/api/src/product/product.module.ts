/**
 * ZYRA — Product Module
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';

@Module({
  imports: [DatabaseModule, EventModule],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
