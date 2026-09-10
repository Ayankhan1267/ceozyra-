import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [ProductModule],
  controllers: [CategoriesController],
})
export class CategoriesModule {}
