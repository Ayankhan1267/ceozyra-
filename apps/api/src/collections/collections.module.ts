import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [ProductModule],
  controllers: [CollectionsController],
})
export class CollectionsModule {}
