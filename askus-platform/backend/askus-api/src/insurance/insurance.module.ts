import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceController } from './insurance.controller';
import { Claim, InsuranceRequest, Policy, Quote } from './insurance.entities';
import { InsuranceAdminController } from './insurance-admin.controller';
import { InsuranceRequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { VehicleService } from './vehicle.service';

@Module({
  imports: [TypeOrmModule.forFeature([Quote, Policy, Claim, InsuranceRequest])],
  controllers: [InsuranceController, InsuranceRequestsController, InsuranceAdminController],
  providers: [RequestsService, VehicleService],
})
export class InsuranceModule {}
