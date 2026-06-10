import { Module } from '@nestjs/common';
import { DataBaseModule } from '../../database/database.module';
import { TenantModule } from '../tenant/tenant.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [DataBaseModule, TenantModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
