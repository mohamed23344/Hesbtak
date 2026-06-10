import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataBaseService } from '../../database/database.service';
import { TenantContext, TenantService } from '../tenant/tenant.service';
import { LanggraphService } from './langgraph/langgraph.service';
import { RunGraphDto } from './langgraph/dto/run-graph.dto';
import { ReportAttachmentService } from './report-attachment.service';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly db: DataBaseService,
    private readonly tenant: TenantService,
    private readonly langgraph: LanggraphService,
    private readonly reports: ReportAttachmentService,
  ) {}

  async run(
    ctx: TenantContext,
    userId: string,
    dto: RunGraphDto,
  ) {
    const sessionId = dto.sessionId ?? randomUUID();
    const conversationHistory = await this.conversationContext(
      ctx,
      userId,
      sessionId,
    );
    const result = await this.langgraph.run(ctx, {
      ...dto,
      userId,
      sessionId,
      conversationHistory,
    });
    this.logger.log(
      `LangGraph handled tenant=${ctx.organizationId} agent=${result.intent ?? 'other'}`,
    );
    const response =
      result.finalResponse ??
      result.agentOutput ??
      'The chatbot did not return a response.';
    const schema = this.tenant.quote(ctx.schemaName);
    await this.db.$executeRawUnsafe(
      `INSERT INTO ${schema}.ai_conversations
       (session_id, user_id, question, response)
       VALUES ($1::uuid, $2::uuid, $3, $4)`,
      sessionId,
      userId,
      dto.userQuery,
      response,
    );
    const attachment = result.reportMarkdown
      ? await this.reports.save(
          ctx,
          userId,
          sessionId,
          result.reportMarkdown,
        )
      : null;
    return {
      sessionId,
      response,
      attachment,
    };
  }

  history(ctx: TenantContext, userId: string, sessionId?: string) {
    const schema = this.tenant.quote(ctx.schemaName);
    return this.db.$queryRawUnsafe(
      `WITH selected_session AS (
         SELECT COALESCE(
           $2::uuid,
           (
             SELECT session_id
             FROM ${schema}.ai_conversations
             WHERE user_id = $1::uuid
             ORDER BY created_at DESC
             LIMIT 1
           )
         ) AS id
       )
       SELECT session_id, question, response, created_at
       FROM ${schema}.ai_conversations
       WHERE user_id = $1::uuid
         AND session_id = (SELECT id FROM selected_session)
       ORDER BY created_at ASC
       LIMIT 100`,
      userId,
      sessionId ?? null,
    );
  }

  private async conversationContext(
    ctx: TenantContext,
    userId: string,
    sessionId: string,
  ) {
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<
      { question: string; response: string }[]
    >(
      `SELECT question, response
       FROM ${schema}.ai_conversations
       WHERE user_id = $1::uuid AND session_id = $2::uuid
       ORDER BY created_at DESC
       LIMIT 12`,
      userId,
      sessionId,
    );
    return rows
      .reverse()
      .map(
        (row) =>
          `User: ${row.question.slice(0, 1000)}\nAssistant: ${row.response.slice(0, 2000)}`,
      )
      .join('\n\n')
      .slice(-12000);
  }
}
