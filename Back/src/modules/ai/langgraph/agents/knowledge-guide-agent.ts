import Groq from 'groq-sdk';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import {
  AssistantCitation,
  AssistantLink,
  KnowledgeCorpus,
} from '../contracts';
import { LLM_MODELS } from '../config/llm.config';
import { StateType } from '../state/graph-state';

export async function knowledgeGuideAgentNode(
  state: StateType,
  groqClient: Groq,
  knowledge: KnowledgeService,
): Promise<Partial<StateType>> {
  const corpora = resolveCorpora(state);
  const retrievalPlan = await optimizeQueries(state, corpora, groqClient);
  const chunks =
    retrievalPlan.coverage === 'comprehensive' &&
    corpora.length === 1 &&
    corpora[0] === 'product_guide'
      ? await knowledge.listCorpus('product_guide', retrievalPlan.limit)
      : await knowledge.retrieve(
          retrievalPlan.queries,
          corpora,
          retrievalPlan.limit,
        );
  if (!chunks.length) {
    const answer =
      'I could not find a sufficiently relevant accounting or Hesbetak guide entry for that request.';
    return {
      knowledgeEvidence: {
        answer,
        citations: [],
        links: [],
        chunks: [],
      },
      agentOutput: answer,
      unresolvedIntent: false,
    };
  }

  const response = await groqClient.chat.completions.create({
    model: LLM_MODELS.CHATTING_AGENT,
    messages: [
      {
        role: 'system',
        content: `You are Hesbetak's accounting and product guide.
Answer only from the supplied knowledge chunks.
For workbook claims cite [K1], [K2]. For product instructions cite the matching
chunk by page title. Do not print raw route paths in the answer; the application
renders the structured links separately. Explain exercises without
pretending the workbook contains an answer key. If evidence is incomplete,
say what is missing. Never invent a route, feature, example, amount, accounting
rule, or workbook answer.

Formatting:
- Use clean GitHub Markdown with short headings and properly spaced lists.
- Write formulas as inline code rather than raw mathematical markup.
- Never emit raw LaTeX delimiters such as \\[ ... \\].
- Preserve the accounting entity, business form, and terminology used by the
  question and evidence instead of silently substituting related concepts.
- Use a numerical example only when it is explicitly present in a retrieved
  chunk, and label it as a workbook example.
- Do not add generic closing filler.
- For a comprehensive product tour, organize all retrieved pages by module,
  explain their purpose and principal actions, cover every retrieved product
  page exactly once, and do not inject live financial analysis.`,
      },
      {
        role: 'user',
        content: `Question: ${state.userQuery}\n\n${chunks
          .map(
            (chunk, index) =>
              `[K${index + 1}] corpus=${chunk.corpus} metadata=${JSON.stringify(chunk.metadata)}\n${chunk.content}`,
          )
          .join('\n\n')}`,
      },
    ],
    temperature: 0.15,
    max_tokens:
      retrievalPlan.coverage === 'comprehensive' ? 3600 : 1800,
  });
  const answer =
    removeRawRoutes(response.choices[0]?.message?.content?.trim() || '') ||
    'Relevant guidance was found, but the response could not be formatted.';
  const citations: AssistantCitation[] = chunks.map((chunk) => ({
    type:
      chunk.corpus === 'accounting_workbook'
        ? 'workbook'
        : 'product_page',
    label:
      chunk.corpus === 'accounting_workbook'
        ? `Financial Accounting Workbook${chunk.metadata.moduleTitle ? `, ${String(chunk.metadata.moduleTitle)}` : ''}`
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
  const links: AssistantLink[] = citations
    .filter((citation) => citation.route)
    .map((citation) => ({
      label: citation.label,
      route: citation.route!,
    }))
    .filter(
      (link, index, all) =>
        all.findIndex((candidate) => candidate.route === link.route) === index,
    );
  const retrievedChunks = chunks.map((chunk) => ({
    id: chunk.id,
    corpus: chunk.corpus,
    documentId: chunk.document_id,
    chunkId: chunk.chunk_id,
    content: chunk.content,
    metadata: chunk.metadata,
    score: Number(chunk.fused_score),
  }));
  return {
    knowledgeEvidence: {
      answer,
      citations,
      links,
      chunks: retrievedChunks,
    },
    agentOutput: answer,
    citations,
    links,
    retrievedChunks,
    unresolvedIntent: false,
  };
}

function removeRawRoutes(value: string) {
  return value
    .replace(/(?:route:\s*)?\/dashboard\/[a-z0-9_./-]+/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function resolveCorpora(state: StateType): KnowledgeCorpus[] {
  const planned = state.requestPlan?.knowledgeCorpora ?? [];
  if (planned.length) return planned;
  if (state.intent === 'accounting_knowledge') return ['accounting_workbook'];
  if (state.intent === 'product_help') return ['product_guide'];
  return ['accounting_workbook', 'product_guide'];
}

async function optimizeQueries(
  state: StateType,
  corpora: KnowledgeCorpus[],
  groqClient: Groq,
) {
  const fallback = {
    queries: [state.userQuery],
    coverage: broadProductRequest(state.userQuery)
      ? ('comprehensive' as const)
      : ('focused' as const),
    limit: broadProductRequest(state.userQuery) ? 50 : 12,
  };
  try {
    const response = await groqClient.chat.completions.create({
      model: LLM_MODELS.ORCHESTRATOR_AGENT,
      messages: [
        {
          role: 'system',
          content: `Plan retrieval for accounting workbook and Hesbetak product-guide corpora.
Create up to five targeted queries. Choose coverage="comprehensive" only when
the user asks for a full system tour, all pages/features/options, or a broad
module inventory; otherwise choose focused. Choose limit from 6 to 30 for
focused retrieval and up to 50 for comprehensive product coverage.
Preserve terminology, module clues, UI labels, and English or Arabic aliases.
Return JSON only:
{"queries": string[], "coverage": "focused" | "comprehensive", "limit": number}.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            request: state.userQuery,
            corpora,
          }),
        },
      ],
      temperature: 0,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });
    const parsed = JSON.parse(
      response.choices[0]?.message?.content || '{}',
    ) as {
      queries?: string[];
      coverage?: 'focused' | 'comprehensive';
      limit?: number;
    };
    if (parsed.queries?.length) {
      const comprehensive =
        broadProductRequest(state.userQuery) ||
        parsed.coverage === 'comprehensive';
      return {
        queries: parsed.queries.slice(0, 5),
        coverage: comprehensive ? 'comprehensive' : 'focused',
        limit: Math.min(
          Math.max(
            comprehensive ? 50 : Number(parsed.limit) || 12,
            6,
          ),
          comprehensive ? 50 : 30,
        ),
      };
    }
  } catch {
    // Use the original request as the retrieval query.
  }
  return fallback;
}

export function broadProductRequest(query: string) {
  return /\b(full|complete|all|entire|comprehensive)\b.*\b(tour|system|website|features|pages|options|modules)\b|\b(system|website|product)\s+tour\b/i.test(
    query,
  );
}
