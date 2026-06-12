import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { TenantModule } from '../tenant/tenant.module';
import { AiInvoiceExtractionController } from './ai-invoice-extraction.controller';
import { AiInvoiceExtractionService } from './ai-invoice-extraction.service';

@Module({
  imports: [AccountingModule, TenantModule],
  controllers: [AiInvoiceExtractionController],
  providers: [AiInvoiceExtractionService],
})
export class AiInvoiceExtractionModule {}
