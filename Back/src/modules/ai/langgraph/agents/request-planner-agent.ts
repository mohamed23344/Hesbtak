import Groq from 'groq-sdk';
import { LLM_MODELS } from '../config/llm.config';
import { RequestPlan } from '../contracts';
import { StateType } from '../state/graph-state';

const DEFAULT_PLAN: RequestPlan = {
  intent: 'general',
  goals: [],
  outputMode: 'chat',
  entities: [],
  knowledgeCorpora: [],
  requiresClarification: false,
};

const SYSTEM_PROMPT = `You plan requests for Hesbetak, an accounting SaaS assistant.

Classify each request into one intent:
- financial_data: exact tenant figures, transactions, balances, analysis, recommendations, forecasting, or financial reports.
- accounting_knowledge: accounting concepts, workbook exercises, journal treatment, formulas, or financial statement guidance.
- product_help: how to use Hesbetak, where a page or action is, or a product tour.
- mixed: the answer requires live organization data plus accounting or product guidance.
- general: greetings or unrelated conversation.

Available accounting modules:
1 Financial Statements; 2 Recording Transactions; 3 Adjusting and Closing;
4 Cash; 5 Receivables; 6 Inventory Purchases and Sales; 7 Inventory Costing;
8 Property Plant and Equipment; 9 Liabilities; 10 Equity;
11 Cash Flows; 12 Ratios and Financial Statement Analysis.

Product modules:
dashboard, accounts, journal, sales, purchases, expenses, transactions,
OCR, forecasting, reports, notifications, settings, support, assistant.

Current date: ${new Date().toISOString().slice(0, 10)}.
Resolve relative dates such as today, this month, this quarter, and last year
into exact ISO dateRange values. Do not assume a quarter when the user did not
ask for one.
Set outputMode to pdf_report only when the user explicitly asks for a PDF,
downloadable report, formal report, or document. A normal analysis is chat.
Ask one clarification question only when a missing period, entity, comparison
baseline, or accounting fact would materially change the answer.
Requests that need organization-specific figures, analysis, diagnosis,
recommendations, forecasts, or reports are financial_data unless the user
explicitly asks for accounting education or product instructions. Do not add
product_help merely because a financial recommendation might later be acted on
inside Hesbetak.

Return valid JSON only with:
intent, goals, outputMode, dateRange, entities, knowledgeCorpora,
requiresClarification, clarificationQuestion.`;

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
      outputMode: explicitlyRequestsReport(
        state.originalUserQuery || state.userQuery,
      )
        ? 'pdf_report'
        : parsed.outputMode === 'pdf_report'
          ? 'pdf_report'
          : 'chat',
      requiresClarification: Boolean(parsed.requiresClarification),
    };
    return {
      requestPlan: plan,
      intent: plan.intent,
      unresolvedIntent: false,
      needsClarification: plan.requiresClarification,
      clarificationQuestion: plan.clarificationQuestion,
    };
  } catch {
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
