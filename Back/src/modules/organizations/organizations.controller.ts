import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('organizations')
  tenants(@CurrentUser() user: JwtUser) {
    return this.organizations.userTenants(user.sub);
  }

  @Get('admin/dashboard')
  adminDashboard(@CurrentUser() user: JwtUser) {
    return this.organizations.adminDashboard(user);
  }
}
