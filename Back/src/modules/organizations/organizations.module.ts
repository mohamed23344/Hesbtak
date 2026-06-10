import { Module } from '@nestjs/common';
import { DataBaseModule } from '../../database/database.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [DataBaseModule, TenantModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
