import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../identity/identity.entities';
import { LoansController } from './loans.controller';
import { LoanApplication, LoanTransaction, Settlement } from './loans.entities';
import { LoansFilesService } from './loans-files.service';
import {
  LoansAdminController, LoansApplicationLookupController, LoansCustomerController, LoansFilesController,
} from './loans-flow.controller';
import {
  CustomerDetails, FormApplication, LoanSupportTicket, LoansAuditLog, QuoteAdminNote, QuoteApplication, QuoteDocument,
  QuoteHistory, QuoteSnapshot,
} from './loans-flow.entities';
import { LoansFlowService } from './loans-flow.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoanApplication, LoanTransaction, Settlement,
      CustomerDetails, QuoteApplication, QuoteDocument, QuoteHistory, QuoteAdminNote, QuoteSnapshot,
      FormApplication, LoanSupportTicket, LoansAuditLog, User,
    ]),
  ],
  controllers: [LoansController, LoansCustomerController, LoansFilesController, LoansAdminController, LoansApplicationLookupController],
  providers: [LoansFlowService, LoansFilesService],
})
export class LoansModule {}
