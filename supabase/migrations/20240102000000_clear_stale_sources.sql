-- Clear stale immigration_sources and immigration_chunks rows
-- that were written without embeddings due to early scraper failures.
-- Run this ONCE manually before the next scraper run.
-- Safe to run: all content will be re-fetched and re-embedded.

DELETE FROM immigration_chunks;
DELETE FROM immigration_sources;
