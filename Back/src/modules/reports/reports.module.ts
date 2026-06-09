import { Module } from '@nestjs/common';
import { DataBaseModule } from '../../database/database.module';
import { TenantModule } from '../tenant/tenant.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [DataBaseModule, TenantModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
