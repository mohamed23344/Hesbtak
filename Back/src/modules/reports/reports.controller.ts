import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { TenantService } from '../tenant/tenant.service';
import {
  CreateScheduleDto,
  GenerateReportDto,
  UpdateReportDto,
  UpdateScheduleDto,
} from './dto';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('tenant/reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly tenant: TenantService,
  ) {}

  private context(orgId: string, user: JwtUser, write = false) {
    return this.tenant.fromOrganizationId(
      orgId,
      user.sub,
      write ? ['owner', 'accountant'] : undefined,
      write ? undefined : 'reports',
    );
  }

  @Get('dashboard')
  async dashboard(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.reports.dashboard(await this.context(orgId, user));
  }

  @Get('templates')
  async templates(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.reports.templates(await this.context(orgId, user));
  }

  @Get()
  async list(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.reports.list(await this.context(orgId, user));
  }

  @Post('preview')
  async preview(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: GenerateReportDto,
  ) {
    return this.reports.generate(await this.context(orgId, user), dto);
  }

  @Post()
  async create(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: GenerateReportDto,
  ) {
    return this.reports.save(await this.context(orgId, user, true), user.sub, dto);
  }

  @Patch(':id')
  async update(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
  ) {
    return this.reports.update(await this.context(orgId, user, true), user.sub, id, dto);
  }

  @Delete(':id')
  async remove(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.reports.remove(await this.context(orgId, user, true), user.sub, id);
  }

  @Post('export')
  async exportPreview(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Query('format') format: 'pdf' | 'xlsx' | 'csv',
    @Body() dto: GenerateReportDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.reports.exportGenerated(await this.context(orgId, user), dto, format);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return new StreamableFile(file.buffer);
  }

  @Get(':id/export')
  async exportSaved(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query('format') format: 'pdf' | 'xlsx' | 'csv',
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.reports.exportSaved(await this.context(orgId, user), id, format);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return new StreamableFile(file.buffer);
  }

  @Get('schedules/list')
  async schedules(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.reports.listSchedules(await this.context(orgId, user));
  }

  @Post('schedules')
  async schedule(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.reports.createSchedule(await this.context(orgId, user, true), user.sub, dto);
  }

  @Patch('schedules/:id')
  async updateSchedule(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.reports.updateSchedule(await this.context(orgId, user, true), user.sub, id, dto);
  }

  @Delete('schedules/:id')
  async removeSchedule(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.reports.removeSchedule(await this.context(orgId, user, true), user.sub, id);
  }

  @Post('schedules/:id/run')
  async runSchedule(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.reports.runSchedule(await this.context(orgId, user, true), id);
  }

  @Get('executions/list')
  async executions(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.reports.executions(await this.context(orgId, user));
  }

  @Get('executions/:id/download')
  async downloadExecution(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.reports.executionFile(await this.context(orgId, user), id);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return new StreamableFile(file.buffer);
  }
}
