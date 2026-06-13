import { LlmClient, LLM_MODELS } from '../config/llm.config';
import { StateType } from '../state/graph-state';
import { aiTrace, aiTraceWarn } from '../trace';

export async function reportGenerationAgentNode(
  state: StateType,
  groqClient: LlmClient,
): Promise<Partial<StateType>> {
  const reportSource =
    state.reasoningOutput ??
    state.knowledgeEvidence?.answer ??
    state.agentOutput;

  if (!reportSource) {
    aiTraceWarn(state, 'report.skipped', {
      reason: 'missing_grounded_source',
    });
    return {
      reportMarkdown: '',
      agentOutput: 'No grounded analysis is available to generate the report.',
    };
  }

  aiTrace(state, 'report.generation_started', {
    sourceLength: reportSource.length,
    sourceType: state.reasoningOutput
      ? 'financial_or_synthesized'
      : state.knowledgeEvidence?.answer
        ? 'knowledge'
        : 'agent_output',
  });
  const response = await groqClient.chat.completions.create({
    model: LLM_MODELS.REPORT_GENERATION_AGENT,
    messages: [
      {
        role: 'system',
        content: `You are a senior financial report writer for ${state.organizationName}.

Create a polished Markdown report that directly matches the user's request.
Infer a specific title and the useful sections from that request and the
verified source material. Do not select from a fixed report template.

Rules:
- Use only facts and figures in the supplied source material.
- Treat verified database evidence as available financial data.
- Do not invent numbers, periods, comparisons, KPIs, risks, or recommendations.
- Do not force quarter comparisons, dashboards, or generic sections.
- Include a KPI or evidence table only when the source supports it.
- Clearly state narrow evidence limitations without claiming all data is absent.
- Use clean GitHub Markdown and begin with a level-one report title.
- Include the organization and generation date below the title.
- Keep the report focused, decision-useful, and suitable for PDF rendering.

Organization: ${state.organizationName}
Generation date: ${new Date().toISOString().slice(0, 10)}`,
      },
      {
        role: 'user',
        content: `User request:
${state.originalUserQuery || state.userQuery}

Verified source material:
${reportSource}`,
      },
    ],
    max_tokens: 3500,
    temperature: 0.15,
  });

  const reportMarkdown =
    response.choices[0]?.message?.content?.trim() ?? '';
  aiTrace(state, 'report.generation_completed', {
    reportLength: reportMarkdown.length,
    generated: Boolean(reportMarkdown),
  });
  return {
    reportMarkdown,
    agentOutput: reportMarkdown
      ? 'Your requested PDF report is ready.'
      : 'Report generation encountered an issue. Please try again.',
  };
}
