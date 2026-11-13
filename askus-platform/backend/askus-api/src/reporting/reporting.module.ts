import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportingController } from './reporting.controller';
import { BusinessSummary, DailyMetric, OutboxEvent } from './reporting.entities';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessSummary, DailyMetric, OutboxEvent])],
  controllers: [ReportingController],
})
export class ReportingModule {}
