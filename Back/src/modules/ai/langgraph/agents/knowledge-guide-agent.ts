import Groq from 'groq-sdk';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { ProductGuideCatalogService } from '../../product-guide/product-guide-catalog.service';
import {
  AssistantCitation,
  AssistantLink,
  FinancialDataRequest,
  KnowledgeCorpus,
  QueryEvidence,
} from '../contracts';
import { LLM_MODELS } from '../config/llm.config';
import { StateType } from '../state/graph-state';
import { aiTrace, aiTraceWarn, errorSummary, summarizeText } from '../trace';
import { DatabaseSearchAgentGraph } from './database-search-agent';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RetrievalPlan {
  queries: string[];
  limit: number;
}

interface ProductRetrievalPlan {
  mode: 'focused' | 'comprehensive';
  pageIds: string[];
  queries: string[];
  limit: number;
}

interface KnowledgeChunk {
  id: string;
  corpus: KnowledgeCorpus;
  document_id: string;
  chunk_id: string;
  content: string;
  metadata: Record<string, unknown>;
  fused_score: number | string;
}

// The answering LLM describes *what* data it needs; DatabaseSearchAgentGraph
// turns each FinancialDataRequest into SQL and runs it (same path as financialReasoning).
const FETCH_ORG_DATA_TOOL: Groq.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'fetch_organization_data',
    description:
      'Request live organization data from the tenant database. Do not pass SQL — ' +
      'describe the evidence needed (objective, metrics, filters, columns) and the ' +
      'database search agent will generate and execute a read-only query. ' +
      'Call when knowledge chunks alone are insufficient. Up to two requests per call.',
    parameters: {
      type: 'object',
      required: ['requests'],
      properties: {
        requests: {
          type: 'array',
          maxItems: 2,
          description:
            'Structured evidence requests passed to the database search agent.',
          items: {
            type: 'object',
            required: ['objective', 'businessQuestion'],
            properties: {
              objective: {
                type: 'string',
                description: 'What data to fetch, e.g. "Active revenue accounts with balances"',
              },
              businessQuestion: {
                type: 'string',
                description: 'Why this data helps answer the user question',
              },
              metrics: {
                type: 'array',
                items: { type: 'string' },
                description: 'Measures to compute, e.g. account balance, invoice total',
              },
              dimensions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Group-by fields, e.g. account type, customer name',
              },
              filters: {
                type: 'array',
                items: { type: 'object' },
                description: 'Field filters: { field, operator, value }',
              },
              dateRange: {
                type: 'object',
                properties: {
                  from: { type: 'string' },
                  to: { type: 'string' },
                },
              },
              expectedColumns: {
                type: 'array',
                items: { type: 'string' },
                description: 'Columns the SQL should return',
              },
              preferredGranularity: {
                type: 'string',
                enum: ['transaction', 'daily', 'monthly', 'quarterly', 'summary'],
              },
              maxRows: { type: 'number', default: 25 },
              reason: {
                type: 'string',
                description: 'Short note on how this evidence improves the answer',
              },
            },
          },
        },
      },
    },
  },
};

// ─── Main Node ────────────────────────────────────────────────────────────────

export async function knowledgeGuideAgentNode(
  state: StateType,
  groqClient: Groq,
  knowledge: KnowledgeService,
  databaseAgent: DatabaseSearchAgentGraph,
  productCatalog: ProductGuideCatalogService,
): Promise<Partial<StateType>> {
  // Step 1: Plan accounting + product retrieval in parallel; schema is injected
  // into the answering prompt so the model knows exactly what it can request.
  const [accountingPlan, productPlan, schemaPrompt] = await Promise.all([
    planAccountingRetrieval(state, groqClient),
    planProductRetrieval(state, productCatalog, groqClient),
    Promise.resolve(databaseAgent.schemaPrompt(state.orgSlug)),
  ]);

  aiTrace(state, 'knowledge.retrieval_plan', {
    accounting: {
      limit: accountingPlan.limit,
      queries: accountingPlan.queries.map((q) => summarizeText(q, 100)),
    },
    product: {
      mode: productPlan.mode,
      limit: productPlan.limit,
      pageIds: productPlan.pageIds,
      queries: productPlan.queries.map((q) => summarizeText(q, 100)),
    },
  });

  // Step 2: Fetch knowledge chunks only — no pre-emptive DB call.
  const retrievalStartedAt = Date.now();
  const [accountingChunks, productChunks] = await Promise.all([
    knowledge.retrieve(
      accountingPlan.queries,
      ['accounting_workbook'],
      accountingPlan.limit,
    ),
    fetchProductChunks(knowledge, productPlan),
  ]);

  const chunks: KnowledgeChunk[] = [...accountingChunks, ...productChunks];

  aiTrace(state, 'knowledge.retrieved', {
    chunkCount: chunks.length,
    elapsedMs: Date.now() - retrievalStartedAt,
    chunks: chunks.map((c) => ({
      corpus: c.corpus,
      chunkId: c.chunk_id,
      page: c.metadata.pageStart,
      route: c.metadata.route,
      score: Number(c.fused_score),
    })),
  });

  if (!chunks.length) {
    const answer =
      'I could not find a sufficiently relevant accounting or Hesbetak guide entry for that request.';
    return {
      knowledgeEvidence: { answer, citations: [], links: [], chunks: [] },
      agentOutput: answer,
      unresolvedIntent: false,
    };
  }

  // Step 3: Agentic answer loop — the LLM writes its answer and may call
  // `fetch_organization_data` one or more times mid-generation whenever it
  // determines live data is needed. We service each tool call and continue.
  const { answer, queryEvidence } = await runAnswerAgentLoop(
    state,
    groqClient,
    databaseAgent,
    chunks,
    productPlan,
    schemaPrompt,
    // Reuse evidence already fetched by a prior node in the graph.
    state.queryEvidence ?? [],
  );

  aiTrace(state, 'knowledge.answer_created', {
    answerLength: answer.length,
    toolCallCount: queryEvidence.length,
    productRouteCount: chunks.filter((c) => typeof c.metadata.route === 'string').length,
  });

  const citations = buildCitations(chunks, queryEvidence);
  const links = buildLinks(citations);
  const retrievedChunks = chunks.map((c) => ({
    id: c.id,
    corpus: c.corpus,
    documentId: c.document_id,
    chunkId: c.chunk_id,
    content: c.content,
    metadata: c.metadata,
    score: Number(c.fused_score),
  }));

  return {
    knowledgeEvidence: { answer, citations, links, chunks: retrievedChunks },
    agentOutput: answer,
    citations,
    links,
    retrievedChunks,
    queryEvidence,
    unresolvedIntent: false,
  };
}

// ─── Agentic Answer Loop ──────────────────────────────────────────────────────

/**
 * Runs the answering LLM in a tool-use loop.
 *
 * The model receives the knowledge chunks and the full DB schema upfront.
 * When it decides it needs live org data to answer properly, it emits a
 * `fetch_organization_data` tool call. We execute it, append the result, and
 * let the model continue. The loop exits when the model produces a final
 * text response (no more tool calls) or after a safety cap of 3 iterations.
 */
async function runAnswerAgentLoop(
  state: StateType,
  groqClient: Groq,
  databaseAgent: DatabaseSearchAgentGraph,
  chunks: KnowledgeChunk[],
  productPlan: ProductRetrievalPlan,
  schemaPrompt: string,
  priorEvidence: QueryEvidence[],
): Promise<{ answer: string; queryEvidence: QueryEvidence[] }> {
  const MAX_TOOL_ROUNDS = 3;
  const allEvidence: QueryEvidence[] = [...priorEvidence];
  let toolCallCount = 0;
  const maxTokens = productPlan.mode === 'comprehensive' ? 3600 : 1800;

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildAnswerSystemPrompt(schemaPrompt) },
    {
      role: 'user',
      content: buildAnswerUserPrompt(state.userQuery, allEvidence, chunks),
    },
  ];

  while (toolCallCount < MAX_TOOL_ROUNDS) {
    let response: Groq.Chat.ChatCompletion;
    try {
      response = await groqClient.chat.completions.create({
        model: LLM_MODELS.CHATTING_AGENT,
        messages,
        tools: [FETCH_ORG_DATA_TOOL],
        tool_choice: 'auto',
        temperature: 0.15,
        max_tokens: maxTokens,
      });
    } catch (error) {
      const recovered = extractToolUseFailedAnswer(error);
      if (recovered) {
        return {
          answer:
            addGroundedProductLinks(cleanAnswer(recovered), chunks) ||
            'Relevant guidance was found, but the response could not be formatted.',
          queryEvidence: allEvidence,
        };
      }
      throw error;
    }

    const choice = response.choices[0];

    // ── Final text answer ──────────────────────────────────────────────────
    if (choice.finish_reason === 'stop' || !choice.message.tool_calls?.length) {
      const raw = choice.message.content?.trim() ?? '';
      return {
        answer:
          addGroundedProductLinks(cleanAnswer(raw), chunks) ||
          'Relevant guidance was found, but the response could not be formatted.',
        queryEvidence: allEvidence,
      };
    }

    // ── Tool call round ────────────────────────────────────────────────────
    // Append the assistant turn (with tool_calls) to history.
    messages.push({ role: 'assistant', content: choice.message.content ?? null, tool_calls: choice.message.tool_calls });

    for (const toolCall of choice.message.tool_calls) {
      if (toolCall.function.name !== 'fetch_organization_data') continue;

      let toolResultContent: string;
      try {
        const args = JSON.parse(toolCall.function.arguments) as {
          requests: Array<Partial<FinancialDataRequest> & { description?: string }>;
        };

        const requests = normalizeKnowledgeDataRequests(
          args.requests,
          toolCallCount,
          state.userQuery,
        );

        const newEvidence = await databaseAgent.executeRequests(
          state,
          requests,
          groqClient,
        );
        allEvidence.push(...newEvidence);
        toolResultContent = JSON.stringify(newEvidence);
      } catch (err) {
        toolResultContent = JSON.stringify({ error: String(err) });
      }

      // Append the tool result so the model can continue.
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: toolResultContent,
      });
    }

    toolCallCount++;
  }

  // Safety fallback: if we hit the loop cap, do one final non-tool call.
  messages.push({
    role: 'user',
    content: 'Please now provide your final answer based on all the data collected above.',
  });
  const finalResponse = await groqClient.chat.completions.create({
    model: LLM_MODELS.CHATTING_AGENT,
    messages,
    temperature: 0.15,
    max_tokens: maxTokens,
  });
  const raw = finalResponse.choices[0]?.message?.content?.trim() ?? '';
  return {
    answer:
      addGroundedProductLinks(cleanAnswer(raw), chunks) ||
      'Relevant guidance was found, but the response could not be formatted.',
    queryEvidence: allEvidence,
  };
}

// ─── Retrieval Planning ───────────────────────────────────────────────────────

async function planAccountingRetrieval(
  state: StateType,
  groqClient: Groq,
): Promise<RetrievalPlan> {
  const fallback: RetrievalPlan = {
    queries: [state.userQuery],
    limit: 4,
  };

  try {
    const response = await groqClient.chat.completions.create({
      model: LLM_MODELS.ORCHESTRATOR_AGENT,
      messages: [
        {
          role: 'system',
          content: `Plan retrieval for the accounting workbook corpus only.
Create up to three targeted queries. Choose limit 4–8 for focused retrieval.
Preserve accounting terminology, entity clues, and English or Arabic aliases.
Return JSON only: {"queries": string[], "limit": number}`,
        },
        {
          role: 'user',
          content: JSON.stringify({ request: state.userQuery }),
        },
      ],
      temperature: 0,
      max_tokens: 250,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(
      response.choices[0]?.message?.content ?? '{}',
    ) as { queries?: string[]; limit?: number };

    if (parsed.queries?.length) {
      return {
        queries: parsed.queries.slice(0, 3),
        limit: Math.min(Math.max(Number(parsed.limit) || 6, 4), 8),
      };
    }
  } catch (error) {
    aiTraceWarn(state, 'knowledge.accounting_plan_fallback', {
      error: errorSummary(error),
    });
  }

  return fallback;
}

async function planProductRetrieval(
  state: StateType,
  productCatalog: ProductGuideCatalogService,
  groqClient: Groq,
): Promise<ProductRetrievalPlan> {
  const comprehensive = broadProductRequest(state.userQuery);
  const fallback: ProductRetrievalPlan = {
    mode: comprehensive ? 'comprehensive' : 'focused',
    pageIds: [],
    queries: [state.userQuery],
    limit: comprehensive ? 50 : 6,
  };

  if (comprehensive) return fallback;

  const validPageIds = new Set(productCatalog.pageIds());
  try {
    const response = await groqClient.chat.completions.create({
      model: LLM_MODELS.ORCHESTRATOR_AGENT,
      messages: [
        {
          role: 'system',
          content: `Plan Hesbetak product-guide retrieval using the catalog index below.
Pick the smallest set of page ids that can answer the request, plus up to two
search queries for semantic backup. Prefer exact page ids over broad retrieval.
Use coverage="comprehensive" only for a full system tour or all pages/modules.
For focused requests choose 1–6 page ids and limit 4–8.
Return JSON only:
{"pageIds": string[], "queries": string[], "coverage": "focused" | "comprehensive", "limit": number}`,
        },
        {
          role: 'user',
          content: `${productCatalog.prompt()}\n\nUser request:\n${state.userQuery}`,
        },
      ],
      temperature: 0,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(
      response.choices[0]?.message?.content ?? '{}',
    ) as {
      pageIds?: string[];
      queries?: string[];
      coverage?: 'focused' | 'comprehensive';
      limit?: number;
    };

    if (parsed.coverage === 'comprehensive' || broadProductRequest(state.userQuery)) {
      return { mode: 'comprehensive', pageIds: [], queries: [], limit: 50 };
    }

    const pageIds = (parsed.pageIds ?? [])
      .filter((id) => validPageIds.has(id))
      .slice(0, 8);
    const queries = (parsed.queries?.length ? parsed.queries : [state.userQuery]).slice(
      0,
      2,
    );

    if (pageIds.length || queries.length) {
      return {
        mode: 'focused',
        pageIds,
        queries,
        limit: Math.min(Math.max(Number(parsed.limit) || 6, 4), 8),
      };
    }
  } catch (error) {
    aiTraceWarn(state, 'knowledge.product_plan_fallback', {
      error: errorSummary(error),
    });
  }

  return fallback;
}

async function fetchProductChunks(
  knowledge: KnowledgeService,
  plan: ProductRetrievalPlan,
): Promise<KnowledgeChunk[]> {
  if (plan.mode === 'comprehensive') {
    return knowledge.listCorpus('product_guide', plan.limit);
  }

  const [byId, bySearch] = await Promise.all([
    plan.pageIds.length
      ? knowledge.getByChunkIds('product_guide', plan.pageIds)
      : Promise.resolve([]),
    plan.queries.length
      ? knowledge.retrieve(plan.queries, ['product_guide'], plan.limit)
      : Promise.resolve([]),
  ]);

  const merged = new Map<string, KnowledgeChunk>();
  for (const chunk of [...byId, ...bySearch]) {
    const existing = merged.get(chunk.id);
    if (!existing || Number(chunk.fused_score) > Number(existing.fused_score)) {
      merged.set(chunk.id, chunk);
    }
  }

  return [...merged.values()]
    .sort((a, b) => Number(b.fused_score) - Number(a.fused_score))
    .slice(0, plan.limit);
}

export function shouldFetchOrgData(
  query: string,
  _chunks: KnowledgeChunk[],
): boolean {
  if (broadProductRequest(query)) return false;
  if (pureAccountingTheoryQuery(query)) return false;
  if (isProceduralGuidanceQuery(query)) return false;

  if (/\b(my|our|mine)\b/i.test(query)) return true;

  return (
    /\b(show me|what are|how much|do i have|do we have|current|existing)\b/i.test(
      query,
    ) &&
    /\b(balance|invoice|transaction|payment|customer|vendor|revenue|expense|ledger|receivable|payable)\b/i.test(
      query,
    )
  );
}

export function isProceduralGuidanceQuery(query: string): boolean {
  const procedural =
    /\b(how do i|how to|how can i|steps to|walk me through|guide me|record a|record the|create a|set up|set up a)\b/i.test(
      query,
    );
  const personalized =
    /\b(my|our|show me my|what are my|how much do i|current balance|existing)\b/i.test(
      query,
    );
  return procedural && !personalized;
}

export function extractToolUseFailedAnswer(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  const jsonStart = message.indexOf('{');
  if (jsonStart < 0) return null;

  try {
    const payload = JSON.parse(message.slice(jsonStart)) as {
      error?: { code?: string; failed_generation?: string };
    };
    if (payload.error?.code !== 'tool_use_failed') return null;
    const text = payload.error.failed_generation?.trim();
    return text || null;
  } catch {
    return null;
  }
}

export function pureAccountingTheoryQuery(query: string): boolean {
  return (
    /\b(what is|define|explain|meaning of|difference between|how does)\b/i.test(
      query,
    ) &&
    !/\b(my|our|hesbetak|dashboard|route|page|click|open)\b/i.test(query)
  );
}

function normalizeKnowledgeDataRequests(
  requests: Array<Partial<FinancialDataRequest> & { description?: string }>,
  toolRound: number,
  userQuery: string,
): FinancialDataRequest[] {
  return requests.slice(0, 2).map((request, index) => {
    const fallbackObjective =
      request.objective?.trim() ||
      request.description?.trim() ||
      userQuery;

    return {
      requestId: `KNOW-FIN-${toolRound + 1}-${index + 1}`,
      objective: fallbackObjective,
      businessQuestion:
        request.businessQuestion?.trim() ||
        request.reason?.trim() ||
        request.description?.trim() ||
        userQuery,
      metrics: Array.isArray(request.metrics) ? request.metrics : [],
      dimensions: Array.isArray(request.dimensions) ? request.dimensions : [],
      filters: Array.isArray(request.filters) ? request.filters : [],
      dateRange: request.dateRange,
      expectedColumns: Array.isArray(request.expectedColumns)
        ? request.expectedColumns
        : [],
      preferredGranularity: request.preferredGranularity ?? 'summary',
      maxRows: Math.min(Math.max(Number(request.maxRows) || 25, 1), 50),
      reason:
        request.reason?.trim() ||
        request.description?.trim() ||
        'Needed to personalize the knowledge-guide answer.',
    };
  });
}

// ─── Prompt Builders ──────────────────────────────────────────────────────────

/**
 * The system prompt now includes the full DB schema so the model knows exactly
 * what tables/columns it can request via the fetch_organization_data tool.
 */
function buildAnswerSystemPrompt(schemaPrompt: string): string {
  return `You are Hesbetak's accounting and product guide.
Answer only from the supplied knowledge chunks and verified organization data.
Use organization data when available to customize the answer; otherwise give
grounded accounting and Hesbetak guidance without pretending tenant data exists.

## When to call fetch_organization_data
Call fetch_organization_data when live tenant data would materially improve the
answer — for example the user asks about *their* balances, invoices, accounts,
customers, or vendors. Do not write SQL — pass structured requests (objective,
metrics, filters, expectedColumns). The database search agent generates and runs
the query.
Good reasons to call:
- The user asks about their specific accounts, balances, or transactions.
- You need current invoice or payment data for a concrete recommendation.
- You must check whether an existing account or customer already exists.
Do NOT call it for:
- Pure accounting theory or textbook exercises.
- Procedural how-to questions ("how do I record...", "steps to create...").
- A comprehensive product tour.
Answer directly from knowledge chunks when org data is not needed.

## Available database schema
${schemaPrompt}

## Answer rules
- For accounting-source claims cite [K1], [K2] etc.
- For product instructions link the page inline using its exact metadata route,
  e.g. [Customers](/dashboard/sales/customers). Never invent or modify a route.
- If a route is not in the provided context, describe what the feature does
  instead of guessing a path.
- Explain exercises without pretending the workbook contains an answer key.
- Never invent a route, feature, amount, accounting rule, or answer.

## Formatting
- Lead with the direct answer. Include only what the user needs.
- Do not repeat instructions under multiple headings.
- Do not add unsolicited tips or filler.
- Use clean GitHub Markdown: short headings, properly spaced lists.
- Write formulas as inline code, never raw LaTeX.
- Preserve the accounting entity, business form, and terminology from the question.
- Use numerical examples only when explicitly present in a retrieved chunk.
- For a comprehensive product tour, organize pages by module, cover each once,
  and omit live financial analysis.`;
}

function buildAnswerUserPrompt(
  userQuery: string,
  priorEvidence: QueryEvidence[],
  chunks: KnowledgeChunk[],
): string {
  const evidenceSection = priorEvidence.length
    ? `Previously fetched organization data:\n${JSON.stringify(priorEvidence)}`
    : 'No organization data fetched yet. Use the fetch_organization_data tool if needed.';

  return `Question: ${userQuery}

${evidenceSection}

Knowledge chunks:
${chunks
    .map(
      (chunk, i) =>
        `[K${i + 1}] corpus=${chunk.corpus} metadata=${JSON.stringify(chunk.metadata)}\n${chunk.content}`,
    )
    .join('\n\n')}`;
}

// ─── Citation & Link Builders ─────────────────────────────────────────────────

function buildCitations(
  chunks: KnowledgeChunk[],
  queryEvidence: QueryEvidence[],
): AssistantCitation[] {
  const citations: AssistantCitation[] = chunks.map((chunk) => ({
    type: chunk.corpus === 'accounting_workbook' ? 'workbook' : 'product_page',
    label:
      chunk.corpus === 'accounting_workbook'
        ? `Introduction to Financial Accounting${chunk.metadata.chapterTitle ? `, ${String(chunk.metadata.chapterTitle)}` : ''}`
        : String(chunk.metadata.title ?? chunk.document_id),
    page:
      typeof chunk.metadata.pageStart === 'number'
        ? chunk.metadata.pageStart
        : undefined,
    route:
      typeof chunk.metadata.route === 'string'
        ? chunk.metadata.route
        : undefined,
  }));

  citations.push(
    ...queryEvidence
      .filter((item) => item.status === 'success')
      .map((item) => ({
        type: 'database_query' as const,
        label: `Live organization data: ${item.requestId}`,
        evidenceRequestId: item.requestId,
      })),
  );

  return citations;
}

function buildLinks(citations: AssistantCitation[]): AssistantLink[] {
  return citations
    .filter((c) => c.route)
    .map((c) => ({ label: c.label, route: c.route! }))
    .filter(
      (link, i, all) =>
        all.findIndex((candidate) => candidate.route === link.route) === i,
    );
}

// ─── Post-processing ──────────────────────────────────────────────────────────

function cleanAnswer(value: string): string {
  return value.replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ').trim();
}

export function addGroundedProductLinks(
  answer: string,
  chunks: Array<{ corpus: KnowledgeCorpus; metadata: Record<string, unknown> }>,
): string {
  let result = answer;
  for (const chunk of chunks) {
    if (chunk.corpus !== 'product_guide') continue;
    const title =
      typeof chunk.metadata.title === 'string' ? chunk.metadata.title : '';
    const route =
      typeof chunk.metadata.route === 'string' ? chunk.metadata.route : '';
    if (!title || !route || result.includes(`](${route})`)) continue;
    result = result.replace(
      new RegExp(escapeRegExp(title), 'i'),
      (label) => `[${label}](${route})`,
    );
  }
  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function broadProductRequest(query: string): boolean {
  return /\b(full|complete|all|entire|comprehensive)\b.*\b(tour|system|website|features|pages|options|modules)\b|\b(system|website|product)\s+tour\b/i.test(
    query,
  );
}