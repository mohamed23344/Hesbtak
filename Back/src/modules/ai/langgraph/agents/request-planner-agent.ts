import Groq from 'groq-sdk';
import { LLM_MODELS } from '../config/llm.config';
import { RequestPlan } from '../contracts';
import { StateType } from '../state/graph-state';
import {
  aiTrace,
  aiTraceWarn,
  errorSummary,
  summarizeText,
} from '../trace';

const DEFAULT_PLAN: RequestPlan = {
  intent: 'general',
  goals: [],
  outputMode: 'chat',
  entities: [],
  knowledgeCorpora: [],
  requiresFinancialData: false,
  requiresClarification: false,
};

const SYSTEM_PROMPT = `You plan requests for Hesbetak, an accounting SaaS assistant.

Classify each request into one intent:
- financial_data: exact tenant figures, transactions, balances, analysis, recommendations, forecasting, or financial reports.
- accounting_knowledge: accounting concepts, workbook exercises, journal treatment, formulas, or financial statement guidance.
- product_help: how to use Hesbetak, where a page or action is, or a product tour.
- mixed: the answer needs more than one source, including accounting plus
  product guidance, or live organization data plus guidance.
- general: greetings or unrelated conversation.


Product modules:
dashboard, accounts, journal, sales, purchases, expenses, transactions,
OCR, forecasting, reports, notifications, settings, support, assistant.

Current date: ${new Date().toISOString().slice(0, 10)}.
Resolve relative dates such as today, this month, this quarter, and last year
into exact ISO dateRange values. ask for clarification if needed depends on the task, like if analysis then i will need quarter or period and so on
DONT ASSUME QUARTER
Set outputMode to pdf_report only when the user explicitly asks for a PDF,
downloadable report, formal report, or document. A normal analysis is chat.
Ask one clarification question only when a missing period, entity, comparison
baseline, or accounting fact would materially change the answer.
Requests that need organization-specific figures, analysis, diagnosis,
recommendations, forecasts, or reports are financial_data unless the user
explicitly asks for accounting education or product instructions. Do not add
product_help merely because a financial recommendation might later be acted on
inside Hesbetak.
Use mixed when the request genuinely combines sources, for example:
- live organization figures plus an accounting explanation;
- live records plus steps for acting on them in Hesbetak;
- accounting treatment plus the exact Hesbetak workflow for recording it.
For mixed requests, choose every required knowledge corpus. For a pure product
navigation request, use only product_guide. For a pure accounting question, use
only accounting_workbook.
Set requiresFinancialData=true only when answering requires tenant-specific
records or figures and when intent is not mixed. Accounting plus product guidance without live records is
mixed with requiresFinancialData=false.

Return valid JSON only with:
intent, goals, outputMode, dateRange, entities, knowledgeCorpora,
requiresFinancialData, requiresClarification, clarificationQuestion.`;

export async function requestPlannerAgentNode(
  state: StateType,
  groqClient: Groq,
): Promise<Partial<StateType>> {
  try {
    const response = await groqClient.chat.completions.create({
      model: LLM_MODELS.ORCHESTRATOR_AGENT,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `${state.conversationHistory ? `Recent conversation:\n${state.conversationHistory}\n\n` : ''}Request:\n${state.userQuery}`,
        },
      ],
      temperature: 0,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });
    const parsed = JSON.parse(
      response.choices[0]?.message?.content || '{}',
    ) as Partial<RequestPlan>;
    const validIntents = [
      'financial_data',
      'accounting_knowledge',
      'product_help',
      'mixed',
      'general',
    ];
    const plan: RequestPlan = {
      ...DEFAULT_PLAN,
      ...parsed,
      intent: validIntents.includes(parsed.intent ?? '')
        ? parsed.intent!
        : 'general',
      goals: Array.isArray(parsed.goals) ? parsed.goals.slice(0, 6) : [],
      entities: Array.isArray(parsed.entities)
        ? parsed.entities.slice(0, 10)
        : [],
      knowledgeCorpora: Array.isArray(parsed.knowledgeCorpora)
        ? parsed.knowledgeCorpora.filter(
            (value) =>
              value === 'accounting_workbook' || value === 'product_guide',
          )
        : [],
      requiresFinancialData:
        parsed.intent === 'financial_data' ||
        Boolean(parsed.requiresFinancialData),
      outputMode: explicitlyRequestsReport(
        state.originalUserQuery || state.userQuery,
      )
        ? 'pdf_report'
        : parsed.outputMode === 'pdf_report'
          ? 'pdf_report'
          : 'chat',
      requiresClarification: Boolean(parsed.requiresClarification),
    };
    aiTrace(state, 'planner.plan_created', {
      intent: plan.intent,
      goals: plan.goals.map((goal) => summarizeText(goal, 80)),
      outputMode: plan.outputMode,
      corpora: plan.knowledgeCorpora,
      requiresFinancialData: plan.requiresFinancialData,
      requiresClarification: plan.requiresClarification,
      entityCount: plan.entities.length,
      dateRange: plan.dateRange,
    });
    return {
      requestPlan: plan,
      intent: plan.intent,
      unresolvedIntent: false,
      needsClarification: plan.requiresClarification,
      clarificationQuestion: plan.clarificationQuestion,
    };
  } catch (error) {
    aiTraceWarn(state, 'planner.fallback', {
      error: errorSummary(error),
    });
    return {
      requestPlan: DEFAULT_PLAN,
      intent: 'general',
      unresolvedIntent: true,
    };
  }
}

export function explicitlyRequestsReport(query: string) {
  return /\b(pdf|downloadable\s+(?:report|document)|(?:generate|create|prepare|produce)\b.{0,80}\breport|formal\s+report|export\s+(?:as\s+)?pdf)\b/i.test(
    query,
  );
}
