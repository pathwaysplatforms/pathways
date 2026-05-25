-- Enable pgvector extension (required for vector columns)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── immigration_sources ────────────────────────────────────────────────────
-- Raw scraped content. Source of truth and audit trail.
-- Chunks are derived from this — if you change embedding models,
-- delete immigration_chunks and re-run the scraper. Never re-scrape.

CREATE TABLE IF NOT EXISTS immigration_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country       TEXT NOT NULL,
  visa_type     TEXT,
  source_url    TEXT NOT NULL,
  title         TEXT,
  raw_markdown  TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  scraped_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  metadata      JSONB NOT NULL DEFAULT '{}',
  UNIQUE (source_url)
);

-- ─── immigration_chunks ─────────────────────────────────────────────────────
-- Chunked + embedded text. Used for pgvector RAG retrieval.

CREATE TABLE IF NOT EXISTS immigration_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id    UUID NOT NULL REFERENCES immigration_sources(id) ON DELETE CASCADE,
  country      TEXT NOT NULL,
  visa_type    TEXT,
  chunk_index  INTEGER NOT NULL,
  chunk_text   TEXT NOT NULL,
  embedding    VECTOR(1536),
  token_count  INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IVFFlat index for fast cosine similarity search
-- Run VACUUM ANALYZE immigration_chunks after bulk inserts to keep it fresh
CREATE INDEX IF NOT EXISTS immigration_chunks_embedding_idx
  ON immigration_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Fast filtering by country before vector search
CREATE INDEX IF NOT EXISTS immigration_chunks_country_idx
  ON immigration_chunks (country);

-- ─── immigration_draws ──────────────────────────────────────────────────────
-- Structured draw/round results. No embeddings — queried directly.

CREATE TABLE IF NOT EXISTS immigration_draws (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country              TEXT NOT NULL,
  program              TEXT NOT NULL,
  draw_date            DATE NOT NULL,
  round_number         INTEGER,
  cutoff_score         INTEGER,
  invitations_issued   INTEGER,
  draw_type            TEXT,
  tie_breaking_date    TIMESTAMPTZ,
  raw_data             JSONB NOT NULL DEFAULT '{}',
  source_url           TEXT,
  scraped_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country, program, draw_date, round_number)
);

CREATE INDEX IF NOT EXISTS immigration_draws_country_program_idx
  ON immigration_draws (country, program, draw_date DESC);

-- ─── immigration_occupation_lists ───────────────────────────────────────────
-- Privileged/targeted occupations per draw cycle.

CREATE TABLE IF NOT EXISTS immigration_occupation_lists (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country          TEXT NOT NULL,
  program          TEXT NOT NULL,
  noc_code         TEXT,
  anzsco_code      TEXT,
  occupation_title TEXT NOT NULL,
  priority_level   TEXT,
  valid_from       DATE,
  valid_until      DATE,
  source_url       TEXT,
  scraped_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE immigration_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE immigration_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE immigration_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE immigration_occupation_lists ENABLE ROW LEVEL SECURITY;

-- Public read — immigration data is public information
CREATE POLICY "public_read_sources"
  ON immigration_sources FOR SELECT USING (TRUE);

CREATE POLICY "public_read_chunks"
  ON immigration_chunks FOR SELECT USING (TRUE);

CREATE POLICY "public_read_draws"
  ON immigration_draws FOR SELECT USING (TRUE);

CREATE POLICY "public_read_occupations"
  ON immigration_occupation_lists FOR SELECT USING (TRUE);

-- Service role only for writes (scrapers use SUPABASE_SERVICE_KEY)
CREATE POLICY "service_write_sources"
  ON immigration_sources FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_write_chunks"
  ON immigration_chunks FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_write_draws"
  ON immigration_draws FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_write_occupations"
  ON immigration_occupation_lists FOR ALL USING (auth.role() = 'service_role');

-- ─── pgvector match function ─────────────────────────────────────────────────
-- Called from Next.js at query time via supabase.rpc('match_immigration_chunks')

CREATE OR REPLACE FUNCTION match_immigration_chunks(
  query_embedding  VECTOR(1536),
  match_threshold  FLOAT    DEFAULT 0.75,
  match_count      INT      DEFAULT 5,
  filter_country   TEXT     DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  chunk_text  TEXT,
  country     TEXT,
  visa_type   TEXT,
  source_url  TEXT,
  similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ic.id,
    ic.chunk_text,
    ic.country,
    ic.visa_type,
    src.source_url,
    1 - (ic.embedding <=> query_embedding) AS similarity
  FROM immigration_chunks ic
  JOIN immigration_sources src ON ic.source_id = src.id
  WHERE
    (filter_country IS NULL OR ic.country = filter_country)
    AND 1 - (ic.embedding <=> query_embedding) > match_threshold
  ORDER BY ic.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
