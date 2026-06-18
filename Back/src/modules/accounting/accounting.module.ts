import { Module } from '@nestjs/common';
import { DataBaseModule } from '../../database/database.module';
import { TenantModule } from '../tenant/tenant.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { ExpenseAccountAgent } from './expense-account.agent';
import { RevenueAccountAgent } from './revenue-account.agent';

@Module({
  imports: [DataBaseModule, TenantModule],
  controllers: [AccountingController],
  providers: [AccountingService, RevenueAccountAgent, ExpenseAccountAgent],
  exports: [AccountingService, RevenueAccountAgent, ExpenseAccountAgent],
})
export class AccountingModule {}
