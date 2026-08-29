-- Express Entry pool size and CRS distribution snapshots
-- Data sourced from IRCC open data (CKAN) and HTML results pages.
-- One row per snapshot date — UNIQUE(snapshot_date) enforced.

CREATE TABLE IF NOT EXISTS ee_pool_snapshots (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date     DATE        NOT NULL,
    total_candidates  INTEGER,
    by_program        JSONB,
    crs_distribution  JSONB,
    source_url        TEXT,
    scraped_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (snapshot_date)
);

CREATE INDEX IF NOT EXISTS ee_pool_snapshots_date_idx
    ON ee_pool_snapshots (snapshot_date DESC);

ALTER TABLE ee_pool_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read — pool data is public information
CREATE POLICY "public_read_ee_pool_snapshots"
    ON ee_pool_snapshots FOR SELECT USING (TRUE);

-- Service role only for writes (scrapers use SUPABASE_SECRET_KEY)
CREATE POLICY "service_write_ee_pool_snapshots"
    ON ee_pool_snapshots FOR ALL USING (auth.role() = 'service_role');
