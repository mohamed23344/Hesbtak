import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { toPgVector } from '../database/sql';
import { EmbeddingProviderService } from '../embeddings/embedding-provider';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeCorpus } from '../langgraph/contracts';

export type KnowledgeChunkInput = {
  corpus: KnowledgeCorpus;
  documentId: string;
  chunkId: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export type KnowledgeChunkResult = {
  id: string;
  corpus: KnowledgeCorpus;
  document_id: string;
  chunk_id: string;
  content: string;
  metadata: Record<string, unknown>;
  vector_rank: number | null;
  lexical_rank: number | null;
  fused_score: number;
};

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingProviderService,
  ) {}

  async upsert(chunks: KnowledgeChunkInput[]) {
    await this.ensureStore();
    const valid = chunks.filter((chunk) => chunk.content.trim()).slice(0, 5000);
    const vectors = await this.embeddings.embedMany(
      valid.map((chunk) => `passage: ${chunk.content.trim()}`),
    );
    await this.prisma.$transaction(
      async (tx) => {
        for (let index = 0; index < valid.length; index += 1) {
          const chunk = valid[index];
          const hash = createHash('sha256')
            .update(chunk.content)
            .digest('hex');
          await tx.$executeRawUnsafe(
            `INSERT INTO public.ai_knowledge_chunks
            (corpus, document_id, chunk_id, content, embedding, metadata, content_hash)
           VALUES ($1, $2, $3, $4, $5::vector, $6::jsonb, $7)
           ON CONFLICT (document_id, chunk_id)
           DO UPDATE SET corpus = EXCLUDED.corpus,
             content = EXCLUDED.content,
             embedding = EXCLUDED.embedding,
             metadata = EXCLUDED.metadata,
             content_hash = EXCLUDED.content_hash,
             updated_at = now()`,
            chunk.corpus,
            chunk.documentId,
            chunk.chunkId,
            chunk.content.trim(),
            toPgVector(vectors[index]),
            JSON.stringify(chunk.metadata ?? {}),
            hash,
          );
        }
      },
      { maxWait: 10_000, timeout: 120_000 },
    );
    return { chunksStored: valid.length };
  }

  async retrieve(
    queries: string[],
    corpora: KnowledgeCorpus[],
    limit = 8,
  ): Promise<KnowledgeChunkResult[]> {
    await this.ensureStore();
    if (!corpora.length) return [];
    const uniqueQueries = [...new Set(queries.map((item) => item.trim()))]
      .filter(Boolean)
      .slice(0, 3);
    const resultSets = await Promise.all(
      uniqueQueries.map(async (query) => {
        const [embedding] = await this.embeddings.embedMany([
          `Instruct: Given an accounting or Hesbetak product-support query, retrieve relevant passages that answer the query.\nQuery: ${query}`,
        ]);
        return this.prisma.$queryRawUnsafe<KnowledgeChunkResult[]>(
          `WITH vector_matches AS (
             SELECT id,
               row_number() OVER (ORDER BY embedding <=> $1::vector) AS rank
             FROM public.ai_knowledge_chunks
             WHERE corpus = ANY($3::text[]) AND embedding IS NOT NULL
             ORDER BY embedding <=> $1::vector
             LIMIT 30
           ),
           lexical_matches AS (
             SELECT id,
               row_number() OVER (
                 ORDER BY ts_rank_cd(content_tsv, websearch_to_tsquery('simple', $2)) DESC
               ) AS rank
             FROM public.ai_knowledge_chunks
             WHERE corpus = ANY($3::text[])
               AND content_tsv @@ websearch_to_tsquery('simple', $2)
             ORDER BY ts_rank_cd(content_tsv, websearch_to_tsquery('simple', $2)) DESC
             LIMIT 30
           ),
           fused AS (
             SELECT id,
               MIN(vector_rank) AS vector_rank,
               MIN(lexical_rank) AS lexical_rank,
               SUM(score) AS fused_score
             FROM (
               SELECT id, rank::int AS vector_rank, NULL::int AS lexical_rank,
                 1.0 / (60 + rank) AS score FROM vector_matches
               UNION ALL
               SELECT id, NULL::int, rank::int,
                 1.0 / (60 + rank) AS score FROM lexical_matches
             ) candidates
             GROUP BY id
           )
           SELECT k.id, k.corpus, k.document_id, k.chunk_id, k.content,
             k.metadata, fused.vector_rank, fused.lexical_rank, fused.fused_score
           FROM fused
           JOIN public.ai_knowledge_chunks k ON k.id = fused.id
           ORDER BY fused.fused_score DESC
           LIMIT $4`,
          toPgVector(embedding),
          query,
          corpora,
          Math.min(Math.max(limit, 1), 40),
        );
      }),
    );
    const best = new Map<string, KnowledgeChunkResult>();
    for (const row of resultSets.flat()) {
      const existing = best.get(row.id);
      if (!existing || Number(row.fused_score) > Number(existing.fused_score)) {
        best.set(row.id, row);
      }
    }
    return [...best.values()]
      .sort((a, b) => Number(b.fused_score) - Number(a.fused_score))
      .slice(0, limit);
  }

  async listCorpus(
    corpus: KnowledgeCorpus,
    limit = 50,
  ): Promise<KnowledgeChunkResult[]> {
    await this.ensureStore();
    return this.prisma.$queryRawUnsafe<KnowledgeChunkResult[]>(
      `SELECT id, corpus, document_id, chunk_id, content, metadata,
         NULL::bigint AS vector_rank,
         NULL::bigint AS lexical_rank,
         1.0::double precision AS fused_score
       FROM public.ai_knowledge_chunks
       WHERE corpus = $1
       ORDER BY
         COALESCE(metadata->>'module', ''),
         COALESCE(metadata->>'title', ''),
         chunk_id
       LIMIT $2`,
      corpus,
      Math.min(Math.max(limit, 1), 100),
    );
  }

  async status() {
    await this.ensureStore();
    return this.prisma.$queryRawUnsafe<
      { corpus: string; chunks: bigint; documents: bigint }[]
    >(
      `SELECT corpus, COUNT(*) AS chunks, COUNT(DISTINCT document_id) AS documents
       FROM public.ai_knowledge_chunks GROUP BY corpus ORDER BY corpus`,
    );
  }

  private async ensureStore() {
    const dimension = this.embeddings.dimensions;
    if (dimension !== 2000) {
      throw new BadRequestException(
        'AI_EMBEDDING_DIMENSIONS must be 2000 for the current knowledge migration.',
      );
    }
    await this.prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.ai_knowledge_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        corpus TEXT NOT NULL CHECK (corpus IN ('accounting_workbook', 'product_guide')),
        document_id TEXT NOT NULL,
        chunk_id TEXT NOT NULL,
        content TEXT NOT NULL,
        content_tsv TSVECTOR GENERATED ALWAYS AS (
          to_tsvector('simple', content)
        ) STORED,
        embedding vector(2000),
        metadata JSONB NOT NULL DEFAULT '{}',
        content_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (document_id, chunk_id)
      );
      CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_corpus_idx
        ON public.ai_knowledge_chunks (corpus);
      CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_fts_idx
        ON public.ai_knowledge_chunks USING gin (content_tsv);
      CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_embedding_idx
        ON public.ai_knowledge_chunks
        USING hnsw (embedding vector_cosine_ops);
    `);
  }
}
