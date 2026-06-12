CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.ai_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corpus TEXT NOT NULL CHECK (
    corpus IN ('accounting_workbook', 'product_guide')
  ),
  document_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  content TEXT NOT NULL,
  content_tsv TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', content)
  ) STORED,
  embedding vector(2000),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_knowledge_chunks_document_chunk_key
    UNIQUE (document_id, chunk_id)
);

CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_corpus_idx
  ON public.ai_knowledge_chunks (corpus);

CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_fts_idx
  ON public.ai_knowledge_chunks USING gin (content_tsv);

CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_embedding_idx
  ON public.ai_knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);
