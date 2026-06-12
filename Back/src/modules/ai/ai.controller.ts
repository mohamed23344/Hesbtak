import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { TenantService } from '../tenant/tenant.service';
import { ChatbotService } from './chatbot.service';
import { RunGraphDto } from './langgraph/dto/run-graph.dto';
import { ReportAttachmentService } from './report-attachment.service';

class ChatRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  userQuery?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  question?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sessionId?: string;

  @IsOptional()
  @IsObject()
  financialReports?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  regulatoryFilters?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  filePayload?: Record<string, unknown>;
}

@UseGuards(JwtAuthGuard)
@Controller('tenant')
export class AiController {
  constructor(
    private readonly tenant: TenantService,
    private readonly chatbot: ChatbotService,
    private readonly reports: ReportAttachmentService,
  ) {}

  @Post('chatbot')
  async chat(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ChatRequestDto,
  ) {
    const userQuery = dto.userQuery ?? dto.question;
    if (!userQuery?.trim()) {
      throw new BadRequestException('question or userQuery is required');
    }
    return this.chatbot.run(
      await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'assistant', 'chatbot'),
      user.sub,
      {
        ...dto,
        userQuery,
      },
    );
  }

  @Post('chatbot/run')
  async runGraph(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: RunGraphDto,
  ) {
    return this.chatbot.run(
      await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'assistant', 'chatbot'),
      user.sub,
      dto,
    );
  }

  @Get('chatbot/history')
  async history(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.chatbot.history(
      await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'assistant', 'chatbot'),
      user.sub,
      sessionId,
    );
  }

  @Get('chatbot/reports/:id.pdf')
  async reportPdf(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') reportId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const report = await this.reports.pdf(
      await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'assistant', 'chatbot'),
      user.sub,
      reportId,
    );
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${report.fileName}"`,
    );
    return new StreamableFile(report.buffer);
  }

}
