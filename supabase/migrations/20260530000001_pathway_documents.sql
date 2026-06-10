-- Pathway documents: curated seed chunks used by the embedding-based matching engine.
-- Each row is one focused chunk from a specific immigration pathway.
-- Embeddings are generated via OpenAI text-embedding-3-small (1536 dims).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS pathway_documents (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id    text          NOT NULL,
  pathway_name  text          NOT NULL,
  country_code  text          NOT NULL,
  pathway_type  text          NOT NULL
    CHECK (pathway_type IN ('permanent_residency', 'work_permit', 'study', 'citizenship', 'family')),
  chunk_text    text          NOT NULL,
  chunk_index   integer       NOT NULL,
  source_url    text,
  source_date   date,
  embedding     vector(1536),
  metadata      jsonb         NOT NULL DEFAULT '{}',
  created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pathway_documents_embedding_idx
  ON pathway_documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS pathway_documents_country_idx
  ON pathway_documents (country_code);

CREATE INDEX IF NOT EXISTS pathway_documents_pathway_id_idx
  ON pathway_documents (pathway_id);

CREATE UNIQUE INDEX IF NOT EXISTS pathway_documents_pathway_chunk_idx
  ON pathway_documents (pathway_id, chunk_index);

ALTER TABLE pathway_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_pathway_documents"
  ON pathway_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_write_pathway_documents"
  ON pathway_documents FOR ALL USING (auth.role() = 'service_role');

-- Match function: returns top N chunks by cosine similarity.
-- Optionally filters by country_code before vector search.
CREATE OR REPLACE FUNCTION match_pathway_documents(
  query_embedding  vector(1536),
  match_count      int       DEFAULT 40,
  filter_country   text      DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  pathway_id   text,
  pathway_name text,
  country_code text,
  pathway_type text,
  chunk_text   text,
  source_url   text,
  metadata     jsonb,
  similarity   float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.id,
    pd.pathway_id,
    pd.pathway_name,
    pd.country_code,
    pd.pathway_type,
    pd.chunk_text,
    pd.source_url,
    pd.metadata,
    1 - (pd.embedding <=> query_embedding) AS similarity
  FROM pathway_documents pd
  WHERE
    pd.embedding IS NOT NULL
    AND (filter_country IS NULL OR pd.country_code = filter_country)
  ORDER BY pd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Pathway match results: cache + history of matching runs per user.
CREATE TABLE IF NOT EXISTS pathway_matches (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  matched_at       timestamptz  NOT NULL DEFAULT now(),
  top_pathways     jsonb        NOT NULL,
  summary          text         NOT NULL DEFAULT '',
  profile_snapshot jsonb        NOT NULL
);

CREATE INDEX IF NOT EXISTS pathway_matches_user_idx
  ON pathway_matches (user_id, matched_at DESC);

ALTER TABLE pathway_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_pathway_matches"
  ON pathway_matches FOR SELECT TO authenticated
  USING (user_id = (
    SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1
  ));

CREATE POLICY "service_write_pathway_matches"
  ON pathway_matches FOR ALL USING (auth.role() = 'service_role');
