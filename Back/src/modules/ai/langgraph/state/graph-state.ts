import { Annotation } from '@langchain/langgraph';
import { TenantContext } from '../../../tenant/tenant.service';
import {
  AssistantCitation,
  AssistantLink,
  KnowledgeEvidence,
  QueryEvidence,
  RequestPlan,
  RetrievedChunk,
} from '../contracts';

/**
 * Defines the state structure for the multi-agent financial graph.
 *
 * Fields:
 *  - userQuery          : original user question
 *  - orgSlug            : tenant identifier
 *  - intent             : classified intent from the orchestrator
 *  - unresolvedIntent   : true when the orchestrator could not classify the query
 *  - agentOutput        : raw text output from the last specialist agent
 *  - finalResponse      : user-facing response formatted by the chatting agent
 *  - requestPlan         : structured intent, sources, entities, and output mode
 *  - queryEvidence       : verified read-only database results
 *  - knowledgeEvidence   : grounded workbook and product guidance
 *  - reasoningOutput     : financial or mixed-source analysis
 *  - reportMarkdown     : final formatted Markdown report from the report generation agent
 *  - reportType         : type of report being generated (inferred by reasoning agent)
 */
export const MultiAgentState = Annotation.Root({
  traceId: Annotation<string>(),
  userQuery: Annotation<string>(),
  originalUserQuery: Annotation<string>(),
  conversationHistory: Annotation<string>(),
  orgSlug: Annotation<string>(),
  tenantContext: Annotation<TenantContext>(),
  organizationName: Annotation<string>(),
  requestPlan: Annotation<RequestPlan | undefined>(),
  intent: Annotation<RequestPlan['intent'] | undefined>(),

  unresolvedIntent: Annotation<boolean | undefined>(),
  needsClarification: Annotation<boolean | undefined>(),
  clarificationQuestion: Annotation<string | undefined>(),
  agentOutput: Annotation<string | undefined>(),
  finalResponse: Annotation<string | undefined>(),
  queryEvidence: Annotation<QueryEvidence[] | undefined>(),
  knowledgeEvidence: Annotation<KnowledgeEvidence | undefined>(),
  citations: Annotation<AssistantCitation[] | undefined>(),
  links: Annotation<AssistantLink[] | undefined>(),
  retrievedChunks: Annotation<RetrievedChunk[] | undefined>(),
  reasoningOutput: Annotation<string | undefined>(),
  reportMarkdown: Annotation<string | undefined>(),
  reportType: Annotation<string | undefined>(),
});

export type StateType = typeof MultiAgentState.State;
