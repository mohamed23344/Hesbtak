import { Module } from '@nestjs/common';
import { DataBaseModule } from '../../database/database.module';
import { TenantModule } from '../tenant/tenant.module';
import { AiController } from './ai.controller';
import { ChatbotService } from './chatbot.service';
import { LanggraphModule } from './langgraph/langgraph.module';
import { ReportAttachmentService } from './report-attachment.service';

@Module({
  imports: [DataBaseModule, TenantModule, LanggraphModule],
  controllers: [AiController],
  providers: [ChatbotService, ReportAttachmentService],
})
export class AiModule {}
