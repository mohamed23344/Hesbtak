import { AssistantCitation } from '../contracts';
import { LlmClient, LLM_MODELS } from '../config/llm.config';
import { StateType } from '../state/graph-state';
import { aiTrace } from '../trace';

export async function responseSynthesisAgentNode(
  state: StateType,
  groqClient: LlmClient,
): Promise<Partial<StateType>> {
  const financial = state.reasoningOutput?.trim();
  const knowledge = state.knowledgeEvidence?.answer?.trim();
  aiTrace(state, 'synthesis.inputs', {
    hasFinancial: Boolean(financial),
    financialLength: financial?.length ?? 0,
    hasKnowledge: Boolean(knowledge),
    knowledgeLength: knowledge?.length ?? 0,
  });
  if (!financial) return { agentOutput: knowledge };
  if (!knowledge) return { agentOutput: financial };

  const response = await groqClient.chat.completions.create({
    model: LLM_MODELS.CHATTING_AGENT,
    messages: [
      {
        role: 'system',
        content: `Combine verified live financial analysis with accounting and product guidance.
Keep live organization facts separate from general guidance.
Preserve inline evidence IDs such as [FIN-1] and knowledge citations such as [K1].
Preserve grounded product-page Markdown links exactly as supplied. Keep the
answer focused on the user's task and omit unrelated retrieved material.
Do not invent facts or routes.
Return the answer only.`,
      },
      {
        role: 'user',
        content: `Request: ${state.userQuery}

Financial analysis:
${financial}

Accounting and product guidance:
${knowledge}`,
      },
    ],
    temperature: 0.15,
    max_tokens: 2200,
  });
  const agentOutput = cleanAnswer(
    response.choices[0]?.message?.content?.trim() ||
      `${financial}\n\n${knowledge}`,
  );
  aiTrace(state, 'synthesis.completed', {
    outputLength: agentOutput.length,
    linkCount: state.knowledgeEvidence?.links.length ?? 0,
  });
  const citations: AssistantCitation[] = [
    ...(state.queryEvidence ?? [])
      .filter((item) => item.status === 'success')
      .map((item) => ({
        type: 'database_query' as const,
        label: `Live organization data: ${item.requestId}`,
        evidenceRequestId: item.requestId,
      })),
    ...(state.knowledgeEvidence?.citations ?? []),
  ];
  return {
    agentOutput,
    reasoningOutput: agentOutput,
    citations: citations.filter(
      (citation, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.type === citation.type &&
            candidate.label === citation.label &&
            candidate.route === citation.route &&
            candidate.page === citation.page,
        ) === index,
    ),
    links: state.knowledgeEvidence?.links ?? [],
  };
}

function cleanAnswer(value: string) {
  return value.replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ').trim();
}
