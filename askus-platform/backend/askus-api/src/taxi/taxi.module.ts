import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxiController } from './taxi.controller';
import { Booking, Driver, Trip, Vehicle } from './taxi.entities';

@Module({
  imports: [TypeOrmModule.forFeature([Driver, Vehicle, Booking, Trip])],
  controllers: [TaxiController],
})
export class TaxiModule {}
