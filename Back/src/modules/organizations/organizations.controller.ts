import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';
import {
  PlanDto,
  UpdateAdminOrganizationDto,
  UpdateAdminUserDto,
  UpdatePlanDto,
} from './dto';

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

  @Get('admin/users')
  adminUsers(@CurrentUser() user: JwtUser) {
    return this.organizations.adminUsers(user);
  }

  @Get('admin/users/:id')
  adminUser(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.organizations.adminUser(user, id);
  }

  @Patch('admin/users/:id')
  updateAdminUser(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.organizations.updateAdminUser(user, id, dto);
  }

  @Delete('admin/users/:id')
  deleteAdminUser(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.organizations.deleteAdminUser(user, id);
  }

  @Get('admin/organizations')
  adminOrganizations(@CurrentUser() user: JwtUser) {
    return this.organizations.adminOrganizations(user);
  }

  @Get('admin/organizations/:id')
  adminOrganization(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.organizations.adminOrganization(user, id);
  }

  @Patch('admin/organizations/:id')
  updateAdminOrganization(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdminOrganizationDto,
  ) {
    return this.organizations.updateAdminOrganization(user, id, dto);
  }

  @Delete('admin/organizations/:id')
  deleteAdminOrganization(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.organizations.deleteAdminOrganization(user, id);
  }

  @Get('admin/plans')
  adminPlans(@CurrentUser() user: JwtUser) {
    return this.organizations.adminPlans(user);
  }

  @Post('admin/plans')
  createPlan(@CurrentUser() user: JwtUser, @Body() dto: PlanDto) {
    return this.organizations.createPlan(user, dto);
  }

  @Patch('admin/plans/:id')
  updatePlan(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.organizations.updatePlan(user, id, dto);
  }

  @Delete('admin/plans/:id')
  deletePlan(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.organizations.deletePlan(user, id);
  }
}
