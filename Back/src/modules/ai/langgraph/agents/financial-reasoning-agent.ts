import Groq from 'groq-sdk';
import { DatabaseSearchAgentGraph } from './database-search-agent';
import {
  FinancialDataRequest,
  QueryEvidence,
} from '../contracts';
import { LLM_MODELS } from '../config/llm.config';
import { StateType } from '../state/graph-state';

type ReasoningDraft = {
  answer?: string;
  needsMoreData?: boolean;
  nextDataRequests?: FinancialDataRequest[];
  needsClarification?: boolean;
  clarificationQuestion?: string;
  limitations?: string[];
};

type DataPlan = {
  requests: FinancialDataRequest[];
  clarificationQuestion?: string;
};

export async function financialReasoningAgentNode(
  state: StateType,
  groqClient: Groq,
  databaseAgent: DatabaseSearchAgentGraph,
): Promise<Partial<StateType>> {
  const dataPlan = await planDataRequests(state, groqClient);
  if (dataPlan.clarificationQuestion) {
    return {
      needsClarification: true,
      clarificationQuestion: dataPlan.clarificationQuestion,
      agentOutput: dataPlan.clarificationQuestion,
      unresolvedIntent: false,
    };
  }
  const initialRequests = dataPlan.requests;
  let evidence: QueryEvidence[] = [];
  let pending = initialRequests;
  let draft: ReasoningDraft = {};

  for (let round = 0; round < 3 && pending.length; round += 1) {
    const normalized = normalizeRequests(
      pending,
      evidence.length,
      state.userQuery,
    );
    const newEvidence = await databaseAgent.executeRequests(
      state,
      normalized,
      groqClient,
    );
    evidence = [...evidence, ...newEvidence];
    draft = await reasonOverEvidence(
      state,
      evidence,
      groqClient,
      round < 2,
    );
    if (draft.needsClarification) {
      return {
        queryEvidence: evidence,
        needsClarification: true,
        clarificationQuestion:
          draft.clarificationQuestion ||
          'Could you clarify the period, entity, or comparison you want analyzed?',
        agentOutput: draft.clarificationQuestion,
        unresolvedIntent: false,
      };
    }
    pending =
      draft.needsMoreData && draft.nextDataRequests?.length
        ? draft.nextDataRequests
        : [];
  }

  const answer =
    draft.answer?.trim() ||
    'I could not collect enough verified financial evidence to answer that request.';
  return {
    queryEvidence: evidence,
    reasoningOutput: answer,
    agentOutput: answer,
    citations: evidence
      .filter((item) => item.status === 'success')
      .map((item) => ({
        type: 'database_query' as const,
        label: `Live organization data: ${item.requestId}`,
        evidenceRequestId: item.requestId,
    })),
    unresolvedIntent: false,
  };
}

async function planDataRequests(
  state: StateType,
  groqClient: Groq,
): Promise<DataPlan> {
  const response = await groqClient.chat.completions.create({
    model: LLM_MODELS.FINANCIAL_REASONING_AGENT,
    messages: [
      {
        role: 'system',
        content: `You are a senior financial analysis planner.
Current date: ${new Date().toISOString().slice(0, 10)}.

Read the user's actual request and create only the database evidence requests
needed to answer it. Never force quarter, month, comparison, cost, revenue, or
working-capital queries unless the user request requires them.

Planning rules:
- Simple factual lookup: usually 1 request.
- Analysis, diagnosis, recommendation, or report: usually 3-8 complementary requests.
- Cover totals, breakdowns, trends, counterparties, and transaction detail only
  when they help answer the stated goal.
- Use the exact dateRange supplied by the request plan.
- Resolve relative dates using the current date.
- Do not invent a comparison period. If a necessary period or entity is
  materially ambiguous, return a clarification instead of requests.
- Prefer posted ledger data for accounting totals and document/payment tables
  for operational details.
- Avoid duplicate requests.

Return JSON only:
{
  "requiresClarification": boolean,
  "clarificationQuestion": string | null,
  "requests": FinancialDataRequest[]
}

Every request includes objective, businessQuestion, metrics, dimensions,
filters, dateRange when relevant, expectedColumns, preferredGranularity,
maxRows, and reason.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          userQuery: state.userQuery,
          requestPlan: state.requestPlan,
          conversationHistory: state.conversationHistory,
        }),
      },
    ],
    temperature: 0,
    max_tokens: 2200,
    response_format: { type: 'json_object' },
  });
  try {
    const parsed = JSON.parse(
      response.choices[0]?.message?.content || '{}',
    ) as {
      requiresClarification?: boolean;
      clarificationQuestion?: string;
      requests?: FinancialDataRequest[];
    };
    if (parsed.requiresClarification) {
      return {
        requests: [],
        clarificationQuestion:
          parsed.clarificationQuestion ||
          'Could you clarify the period, entity, or comparison you want analyzed?',
      };
    }
    if (parsed.requests?.length) {
      return { requests: parsed.requests.slice(0, 10) };
    }
  } catch {
    // Use one dynamic request as a resilient fallback.
  }
  return {
    requests: [
      {
        requestId: 'FIN-1',
        objective: state.userQuery,
        businessQuestion: state.userQuery,
        metrics: [],
        dimensions: [],
        filters: [],
        dateRange: state.requestPlan?.dateRange,
        expectedColumns: [],
        preferredGranularity: 'summary',
        maxRows: 50,
        reason: 'Collect the most relevant verified evidence for the request.',
      },
    ],
  };
}

function normalizeRequests(
  requests: FinancialDataRequest[],
  existingCount: number,
  userQuery: string,
) {
  return requests
    .slice(0, 10)
    .map((request, index) => ({
      ...request,
      requestId: `FIN-${existingCount + index + 1}`,
      objective: request.objective?.trim() || userQuery,
      businessQuestion: request.businessQuestion?.trim() || userQuery,
      metrics: Array.isArray(request.metrics) ? request.metrics : [],
      dimensions: Array.isArray(request.dimensions) ? request.dimensions : [],
      filters: Array.isArray(request.filters) ? request.filters : [],
      expectedColumns: Array.isArray(request.expectedColumns)
        ? request.expectedColumns
        : [],
      maxRows: Math.min(Math.max(Number(request.maxRows) || 50, 1), 200),
      reason: request.reason?.trim() || 'Needed to answer the user request.',
    }));
}

async function reasonOverEvidence(
  state: StateType,
  evidence: QueryEvidence[],
  groqClient: Groq,
  mayRequestMore: boolean,
): Promise<ReasoningDraft> {
  const compactEvidence = evidence.map(
    ({
      requestId,
      objective,
      dateRange,
      status,
      rows,
      rowCount,
      truncation,
      assumptions,
      warnings,
    }) => ({
      requestId,
      objective,
      dateRange,
      status,
      rows,
      rowCount,
      truncation,
      assumptions,
      warnings,
    }),
  );
  const response = await groqClient.chat.completions.create({
    model: LLM_MODELS.FINANCIAL_REASONING_AGENT,
    messages: [
      {
        role: 'system',
        content: `You are a senior financial analyst for ${state.organizationName}.
Answer the user's actual question using only supplied evidence.
Do not impose a fixed report structure. Choose headings, tables, calculations,
and detail that best fit the request.

Rules:
- Preserve exact values and distinguish ledger values from document values.
- Cite material facts inline as [FIN-1], [FIN-2].
- Treat successful zero-valued aggregates as evidence, not retrieval failure.
- Read all successful evidence before concluding data is unavailable.
- Do not invent recommendations, dates, comparisons, or missing figures.
- Do not output raw SQL, raw routes, placeholder IDs, or internal terminology.
- Use clean GitHub Markdown: headings, lists, and tables where they improve clarity.
- Write formulas as plain Markdown or inline code, not malformed LaTeX delimiters.
- For recommendations, tie actions to named evidence and amounts.
- Put empty or failed requests in a short limitations section only when relevant.

${mayRequestMore ? `If important evidence is missing, return targeted additional data requests.
If the missing context cannot be discovered from the database, ask one focused
clarification question.` : 'No more database rounds are available. Answer with explicit limitations.'}

Return JSON only:
{
  "answer": string,
  "needsMoreData": boolean,
  "nextDataRequests": FinancialDataRequest[],
  "needsClarification": boolean,
  "clarificationQuestion": string | null,
  "limitations": string[]
}.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          userQuery: state.userQuery,
          requestPlan: state.requestPlan,
          evidence: compactEvidence,
        }),
      },
    ],
    temperature: 0.1,
    max_tokens: 3000,
    response_format: { type: 'json_object' },
  });
  try {
    return JSON.parse(
      response.choices[0]?.message?.content || '{}',
    ) as ReasoningDraft;
  } catch {
    return {
      answer:
        'The financial evidence was retrieved, but the analysis could not be formatted reliably.',
      needsMoreData: false,
      nextDataRequests: [],
    };
  }
}
