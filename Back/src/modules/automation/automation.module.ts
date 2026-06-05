import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DataBaseModule } from '../../database/database.module';
import { AccountingModule } from '../accounting/accounting.module';
import { TenantModule } from '../tenant/tenant.module';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';

@Module({
  imports: [ScheduleModule.forRoot(), DataBaseModule, TenantModule, AccountingModule],
  controllers: [AutomationController],
  providers: [AutomationService],
})
export class AutomationModule {}
