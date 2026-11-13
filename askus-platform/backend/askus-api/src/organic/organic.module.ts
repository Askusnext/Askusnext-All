import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganicController } from './organic.controller';
import { Inventory, OrganicOrder, OrganicProduct } from './organic.entities';

@Module({
  imports: [TypeOrmModule.forFeature([OrganicProduct, OrganicOrder, Inventory])],
  controllers: [OrganicController],
})
export class OrganicModule {}
