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

type GraphRunInput = RunGraphDto & { conversationHistory?: string };

@Injectable()
export class LanggraphService {
  private readonly groqClient: Groq;
  private readonly compiledGraph;

  constructor(
    private readonly config: ConfigService,
    private readonly databaseAgent: DatabaseSearchAgentGraph,
    private readonly knowledge: KnowledgeService,
    private readonly prisma: PrismaService,
  ) {
    this.groqClient = getGroqClient(this.config);
    const workflow = new StateGraph(MultiAgentState)
      .addNode('requestPlanner', (state) =>
        requestPlannerAgentNode(state, this.groqClient),
      )
      .addNode('financialReasoning', (state) =>
        financialReasoningAgentNode(
          state,
          this.groqClient,
          this.databaseAgent,
        ),
      )
      .addNode('knowledgeGuide', (state) =>
        knowledgeGuideAgentNode(state, this.groqClient, this.knowledge),
      )
      .addNode('synthesize', (state) =>
        responseSynthesisAgentNode(state, this.groqClient),
      )
      .addNode('reportGeneration', (state) =>
        reportGenerationAgentNode(state, this.groqClient),
      )
      .addNode('chattingAgent', (state) =>
        chattingAgentNode(state, this.groqClient),
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
    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      });
      const conversationHistory = dto.conversationHistory?.trim() ?? '';
      const contextualQuery = await this.contextualizeQuery(
        dto.userQuery,
        conversationHistory,
      );
      const initialState: Partial<StateType> = {
        userQuery: contextualQuery,
        originalUserQuery: dto.userQuery,
        conversationHistory,
        orgSlug: ctx.schemaName,
        tenantContext: ctx,
        organizationName: organization?.name ?? 'your organization',
      };
      const result = await this.compiledGraph.invoke(initialState);
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
      if (error instanceof ServiceUnavailableException) throw error;
      throw new InternalServerErrorException(
        `LangGraph execution failed: ${String(error)}`,
      );
    }
  }

  private async contextualizeQuery(
    userQuery: string,
    conversationHistory: string,
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
    } catch {
      return userQuery;
    }
  }

  private routeFromPlanner(state: StateType) {
    if (state.needsClarification) return 'chattingAgent';
    if (state.intent === 'financial_data' || state.intent === 'mixed') {
      return 'financialReasoning';
    }
    if (
      state.intent === 'accounting_knowledge' ||
      state.intent === 'product_help'
    ) {
      return 'knowledgeGuide';
    }
    return 'chattingAgent';
  }

  private routeAfterFinancial(state: StateType) {
    if (state.needsClarification) return 'chattingAgent';
    if (state.intent === 'mixed') return 'knowledgeGuide';
    return state.requestPlan?.outputMode === 'pdf_report'
      ? 'reportGeneration'
      : 'chattingAgent';
  }

  private routeAfterKnowledge(state: StateType) {
    if (state.requestPlan?.outputMode === 'pdf_report') {
      return state.intent === 'mixed' ? 'synthesize' : 'reportGeneration';
    }
    return state.intent === 'mixed' ? 'synthesize' : 'chattingAgent';
  }

  private routeAfterSynthesis(state: StateType) {
    return state.requestPlan?.outputMode === 'pdf_report'
      ? 'reportGeneration'
      : 'chattingAgent';
  }
}
