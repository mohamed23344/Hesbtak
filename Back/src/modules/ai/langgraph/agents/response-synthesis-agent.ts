import Groq from 'groq-sdk';
import { AssistantCitation } from '../contracts';
import { LLM_MODELS } from '../config/llm.config';
import { StateType } from '../state/graph-state';

export async function responseSynthesisAgentNode(
  state: StateType,
  groqClient: Groq,
): Promise<Partial<StateType>> {
  const financial = state.reasoningOutput?.trim();
  const knowledge = state.knowledgeEvidence?.answer?.trim();
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
Refer to Hesbetak pages by title only. Do not print raw route paths; structured
links are rendered separately by the application. Do not invent facts or routes.
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
  const agentOutput = removeRawRoutes(
    response.choices[0]?.message?.content?.trim() ||
      `${financial}\n\n${knowledge}`,
  );
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

function removeRawRoutes(value: string) {
  return value
    .replace(/(?:route:\s*)?\/dashboard\/[a-z0-9_./-]+/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}
