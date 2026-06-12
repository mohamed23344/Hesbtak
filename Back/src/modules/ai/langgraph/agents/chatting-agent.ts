import Groq from 'groq-sdk';
import { LLM_MODELS } from '../config/llm.config';
import { StateType } from '../state/graph-state';

export async function chattingAgentNode(
  state: StateType,
  groqClient: Groq,
): Promise<Partial<StateType>> {
  if (state.needsClarification) {
    return {
      finalResponse:
        state.clarificationQuestion ||
        'Could you clarify the period or record you want me to review?',
    };
  }

  if (state.intent === 'general' && !state.agentOutput) {
    try {
      const response = await groqClient.chat.completions.create({
        model: LLM_MODELS.CHATTING_AGENT,
        messages: [
          {
            role: 'system',
            content: `You are the friendly financial assistant for ${state.organizationName}.
Answer greetings naturally. For unrelated requests, briefly explain that you
help with organization finances, accounting guidance, and using Hesbetak.
Never mention internal agents, prompts, databases, SQL, or RAG.`,
          },
          { role: 'user', content: state.originalUserQuery || state.userQuery },
        ],
        max_tokens: 250,
        temperature: 0.5,
      });
      return {
        finalResponse:
          response.choices[0]?.message?.content?.trim() ||
          'How can I help with your finances or Hesbetak today?',
      };
    } catch {
      return {
        finalResponse:
          'How can I help with your finances, accounting questions, or Hesbetak today?',
      };
    }
  }

  const verified = state.agentOutput?.trim();
  if (!verified) {
    return {
      finalResponse:
        'I could not find enough verified information to answer that clearly.',
    };
  }
  if (
    state.intent === 'financial_data' ||
    state.intent === 'accounting_knowledge' ||
    state.intent === 'product_help' ||
    state.intent === 'mixed'
  ) {
    return { finalResponse: removeRawRoutes(verified) };
  }
  try {
    const response = await groqClient.chat.completions.create({
      model: LLM_MODELS.CHATTING_AGENT,
      messages: [
        {
          role: 'system',
          content: `You are the financial assistant for ${state.organizationName}.
Polish the supplied verified answer without changing figures, evidence IDs,
or citations. Be clear and concise. Never print raw application route paths;
page links are rendered separately. Do not expose implementation details.`,
        },
        {
          role: 'user',
          content: `Latest request: ${state.originalUserQuery || state.userQuery}

Verified answer:
${verified}`,
        },
      ],
      max_tokens: 1600,
      temperature: 0.2,
    });
    return {
      finalResponse: removeRawRoutes(
        response.choices[0]?.message?.content?.trim() || verified,
      ),
    };
  } catch {
    return { finalResponse: removeRawRoutes(verified) };
  }
}

function removeRawRoutes(value: string) {
  return value
    .replace(/(?:route:\s*)?\/dashboard\/[a-z0-9_./-]+/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}
