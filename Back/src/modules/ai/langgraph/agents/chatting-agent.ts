import Groq from 'groq-sdk';
import { LLM_MODELS } from '../config/llm.config';
import { StateType } from '../state/graph-state';
import {
  aiTrace,
  aiTraceWarn,
  errorSummary,
} from '../trace';

export async function chattingAgentNode(
  state: StateType,
  groqClient: Groq,
): Promise<Partial<StateType>> {
  if (state.needsClarification) {
    aiTrace(state, 'chat.response_clarification', {
      questionLength: state.clarificationQuestion?.length ?? 0,
    });
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
      const finalResponse =
        response.choices[0]?.message?.content?.trim() ||
        'How can I help with your finances or Hesbetak today?';
      aiTrace(state, 'chat.general_response', {
        responseLength: finalResponse.length,
      });
      return {
        finalResponse,
      };
    } catch (error) {
      aiTraceWarn(state, 'chat.general_fallback', {
        error: errorSummary(error),
      });
      return {
        finalResponse:
          'How can I help with your finances, accounting questions, or Hesbetak today?',
      };
    }
  }

  const verified = state.agentOutput?.trim();
  if (!verified) {
    aiTraceWarn(state, 'chat.missing_verified_output');
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
    const finalResponse = cleanAnswer(verified);
    aiTrace(state, 'chat.verified_response', {
      intent: state.intent,
      responseLength: finalResponse.length,
    });
    return { finalResponse };
  }
  try {
    const response = await groqClient.chat.completions.create({
      model: LLM_MODELS.CHATTING_AGENT,
      messages: [
        {
          role: 'system',
          content: `You are the financial assistant for ${state.organizationName}.
Polish the supplied verified answer without changing figures, evidence IDs,
citations, or grounded Markdown links. Be clear and concise. Do not expose
implementation details.`,
        },
        {
          role: 'user',
          content: `Latest request: ${state.originalUserQuery || state.userQuery}

Verified answer:
${verified}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.2,
    });
    const finalResponse = cleanAnswer(
      response.choices[0]?.message?.content?.trim() || verified,
    );
    aiTrace(state, 'chat.polished_response', {
      responseLength: finalResponse.length,
    });
    return { finalResponse };
  } catch (error) {
    aiTraceWarn(state, 'chat.polish_fallback', {
      error: errorSummary(error),
    });
    return { finalResponse: cleanAnswer(verified) };
  }
}

function cleanAnswer(value: string) {
  return value.replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ').trim();
}
