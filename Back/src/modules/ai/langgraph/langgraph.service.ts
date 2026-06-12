import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { END, START, StateGraph } from '@langchain/langgraph';
import Groq from 'groq-sdk';
import { TenantContext } from '../../tenant/tenant.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ProductGuideCatalogService } from '../product-guide/product-guide-catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { chattingAgentNode } from './agents/chatting-agent';
import { DatabaseSearchAgentGraph } from './agents/database-search-agent';
import { financialReasoningAgentNode } from './agents/financial-reasoning-agent';
import { knowledgeGuideAgentNode } from './agents/knowledge-guide-agent';
import { reportGenerationAgentNode } from './agents/report-generation-agent';
import { requestPlannerAgentNode } from './agents/request-planner-agent';
import { responseSynthesisAgentNode } from './agents/response-synthesis-agent';
import {
  getGroqClient,
  hasGroqApiKey,
  LLM_MODELS,
} from './config/llm.config';
import { RunGraphDto } from './dto/run-graph.dto';
import { MultiAgentState, StateType } from './state/graph-state';
import {
  aiTrace,
  aiTraceWarn,
  errorSummary,
  summarizeText,
} from './trace';

type GraphRunInput = RunGraphDto & { conversationHistory?: string };

@Injectable()
export class LanggraphService {
  private readonly groqClient: Groq;
  private readonly compiledGraph;

  constructor(
    private readonly config: ConfigService,
    private readonly databaseAgent: DatabaseSearchAgentGraph,
    private readonly knowledge: KnowledgeService,
    private readonly productCatalog: ProductGuideCatalogService,
    private readonly prisma: PrismaService,
  ) {
    this.groqClient = getGroqClient(this.config);
    const workflow = new StateGraph(MultiAgentState)
      .addNode('requestPlanner', (state) =>
        this.runNode('requestPlanner', state, () =>
          requestPlannerAgentNode(state, this.groqClient),
        ),
      )
      .addNode('financialReasoning', (state) =>
        this.runNode('financialReasoning', state, () =>
          financialReasoningAgentNode(
            state,
            this.groqClient,
            this.databaseAgent,
          ),
        ),
      )
      .addNode('knowledgeGuide', (state) =>
        this.runNode('knowledgeGuide', state, () =>
          knowledgeGuideAgentNode(
            state,
            this.groqClient,
            this.knowledge,
            this.databaseAgent,
            this.productCatalog,
          ),
        ),
      )
      .addNode('synthesize', (state) =>
        this.runNode('synthesize', state, () =>
          responseSynthesisAgentNode(state, this.groqClient),
        ),
      )
      .addNode('reportGeneration', (state) =>
        this.runNode('reportGeneration', state, () =>
          reportGenerationAgentNode(state, this.groqClient),
        ),
      )
      .addNode('chattingAgent', (state) =>
        this.runNode('chattingAgent', state, () =>
          chattingAgentNode(state, this.groqClient),
        ),
      )
      .addEdge(START, 'requestPlanner')
      .addConditionalEdges(
        'requestPlanner',
        this.routeFromPlanner.bind(this),
      )
      .addConditionalEdges(
        'financialReasoning',
        this.routeAfterFinancial.bind(this),
      )
      .addConditionalEdges(
        'knowledgeGuide',
        this.routeAfterKnowledge.bind(this),
      )
      .addConditionalEdges(
        'synthesize',
        this.routeAfterSynthesis.bind(this),
      )
      .addEdge('reportGeneration', 'chattingAgent')
      .addEdge('chattingAgent', END);
    this.compiledGraph = workflow.compile();
  }

  async run(ctx: TenantContext, dto: GraphRunInput) {
    if (!hasGroqApiKey(this.config)) {
      throw new ServiceUnavailableException(
        'AI assistant is not configured. Set GROQ_API_KEY in the backend environment.',
      );
    }
    const traceId = dto.sessionId ?? `run-${Date.now()}`;
    const startedAt = Date.now();
    aiTrace(
      { traceId },
      'graph.started',
      {
        organizationId: ctx.organizationId,
        queryLength: dto.userQuery.length,
        queryPreview: summarizeText(dto.userQuery),
        hasConversationHistory: Boolean(dto.conversationHistory?.trim()),
      },
    );
    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      });
      const conversationHistory = dto.conversationHistory?.trim() ?? '';
      const contextualQuery = await this.contextualizeQuery(
        dto.userQuery,
        conversationHistory,
        traceId,
      );
      const initialState: Partial<StateType> = {
        traceId,
        userQuery: contextualQuery,
        originalUserQuery: dto.userQuery,
        conversationHistory,
        orgSlug: ctx.schemaName,
        tenantContext: ctx,
        organizationName: organization?.name ?? 'your organization',
      };
      aiTrace(initialState, 'graph.context_ready', {
        organizationName: initialState.organizationName,
        queryWasContextualized: contextualQuery !== dto.userQuery,
        contextualQueryPreview: summarizeText(contextualQuery),
        historyLength: conversationHistory.length,
      });
      const result = await this.compiledGraph.invoke(initialState);
      aiTrace(result, 'graph.completed', {
        intent: result.intent,
        needsClarification: result.needsClarification ?? false,
        evidenceCount: result.queryEvidence?.length ?? 0,
        retrievedChunkCount: result.retrievedChunks?.length ?? 0,
        citationCount: result.citations?.length ?? 0,
        linkCount: result.links?.length ?? 0,
        hasReport: Boolean(result.reportMarkdown),
        responseLength:
          result.finalResponse?.length ?? result.agentOutput?.length ?? 0,
        elapsedMs: Date.now() - startedAt,
      });
      return {
        intent: result.intent,
        agentOutput: result.agentOutput,
        finalResponse: result.finalResponse,
        unresolvedIntent: result.unresolvedIntent ?? false,
        needsClarification: result.needsClarification ?? false,
        citations: result.citations ?? [],
        links: result.links ?? [],
        retrievedChunks: result.retrievedChunks ?? [],
        reportMarkdown: result.reportMarkdown ?? null,
      };
    } catch (error) {
      aiTraceWarn({ traceId }, 'graph.failed', {
        error: errorSummary(error),
        elapsedMs: Date.now() - startedAt,
      });
      if (error instanceof ServiceUnavailableException) throw error;
      throw new InternalServerErrorException(
        `LangGraph execution failed: ${String(error)}`,
      );
    }
  }

  private async contextualizeQuery(
    userQuery: string,
    conversationHistory: string,
    traceId: string,
  ) {
    if (!conversationHistory) return userQuery;
    try {
      const response = await this.groqClient.chat.completions.create({
        model: LLM_MODELS.ORCHESTRATOR_AGENT,
        messages: [
          {
            role: 'system',
            content:
              'Rewrite the latest message as a standalone request using the conversation history. Preserve intent, names, dates, language, and requested output format. Return only the rewritten request.',
          },
          {
            role: 'user',
            content: `History:\n${conversationHistory}\n\nLatest:\n${userQuery}`,
          },
        ],
        temperature: 0,
        max_tokens: 350,
      });
      return response.choices[0]?.message?.content?.trim() || userQuery;
    } catch (error) {
      aiTraceWarn({ traceId }, 'contextualizer.fallback', {
        error: errorSummary(error),
      });
      return userQuery;
    }
  }

  private routeFromPlanner(state: StateType) {
    let destination: string;
    if (state.needsClarification) destination = 'chattingAgent';
    else if (
      state.intent === 'financial_data' ||
      (state.intent === 'mixed' &&
        state.requestPlan?.requiresFinancialData)
    ) {
      destination = 'financialReasoning';
    } else if (
      state.intent === 'accounting_knowledge' ||
      state.intent === 'product_help' ||
      state.intent === 'mixed'
    ) {
      destination = 'knowledgeGuide';
    } else {
      destination = 'chattingAgent';
    }
    aiTrace(state, 'route.after_planner', {
      intent: state.intent,
      requiresFinancialData:
        state.requestPlan?.requiresFinancialData ?? false,
      destination,
    });
    return destination;
  }

  private routeAfterFinancial(state: StateType) {
    const destination = state.needsClarification
      ? 'chattingAgent'
      : state.intent === 'mixed'
        ? 'knowledgeGuide'
        : state.requestPlan?.outputMode === 'pdf_report'
          ? 'reportGeneration'
          : 'chattingAgent';
    aiTrace(state, 'route.after_financial', {
      destination,
      evidenceCount: state.queryEvidence?.length ?? 0,
    });
    return destination;
  }

  private routeAfterKnowledge(state: StateType) {
    const destination =
      state.requestPlan?.outputMode === 'pdf_report'
        ? state.intent === 'mixed'
          ? 'synthesize'
          : 'reportGeneration'
        : state.intent === 'mixed'
          ? 'synthesize'
          : 'chattingAgent';
    aiTrace(state, 'route.after_knowledge', {
      destination,
      retrievedChunkCount: state.retrievedChunks?.length ?? 0,
    });
    return destination;
  }

  private routeAfterSynthesis(state: StateType) {
    const destination =
      state.requestPlan?.outputMode === 'pdf_report'
        ? 'reportGeneration'
        : 'chattingAgent';
    aiTrace(state, 'route.after_synthesis', { destination });
    return destination;
  }

  private async runNode(
    name: string,
    state: StateType,
    run: () => Promise<Partial<StateType>>,
  ) {
    const startedAt = Date.now();
    aiTrace(state, 'agent.started', { agent: name });
    try {
      const result = await run();
      aiTrace(state, 'agent.completed', {
        agent: name,
        elapsedMs: Date.now() - startedAt,
        outputLength:
          result.finalResponse?.length ??
          result.agentOutput?.length ??
          result.reportMarkdown?.length ??
          0,
      });
      return result;
    } catch (error) {
      aiTraceWarn(state, 'agent.failed', {
        agent: name,
        error: errorSummary(error),
        elapsedMs: Date.now() - startedAt,
      });
      throw error;
    }
  }
}
