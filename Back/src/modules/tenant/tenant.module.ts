import { Module } from '@nestjs/common';
import { DataBaseModule } from '../../database/database.module';
import { TenantService } from './tenant.service';

@Module({
  imports: [DataBaseModule],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
