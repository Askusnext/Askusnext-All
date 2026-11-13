import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoansController } from './loans.controller';
import { LoanApplication, LoanTransaction, Settlement } from './loans.entities';

@Module({
  imports: [TypeOrmModule.forFeature([LoanApplication, LoanTransaction, Settlement])],
  controllers: [LoansController],
})
export class LoansModule {}
