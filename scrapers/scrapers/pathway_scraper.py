import os
import sys
from pathlib import Path

import yaml
from dotenv import load_dotenv

# Allow running as `python -m scrapers.pathway_scraper` from scrapers/
sys.path.insert(0, str(Path(__file__).parent.parent))

from scrapers.base import BaseScraper
from pipeline.chunker import chunk_markdown
from pipeline.embedder import embed_chunks
from pipeline.upserter import upsert_source, upsert_chunks
from utils.hash_utils import compute_hash
from utils.logger import get_logger

load_dotenv()
logger = get_logger(__name__)


class PathwayScraper(BaseScraper):
    def __init__(self) -> None:
        super().__init__()
        config_path = Path(__file__).parent.parent / "config" / "sources.yaml"
        with open(config_path) as f:
            self.config: dict = yaml.safe_load(f)["pathways"]

    def run(self) -> None:
        logger.info("=== Pathway Scraper started ===")
        total_sources = 0
        total_chunks = 0

        for country, visa_types in self.config.items():
            for visa_type, cfg in visa_types.items():
                logger.info(f"Processing: {country}/{visa_type}")
                sources, chunks = self._process_pathway(country, visa_type, cfg)
                total_sources += sources
                total_chunks += chunks

        logger.info(
            f"=== Pathway Scraper finished | "
            f"{total_sources} sources processed | "
            f"{total_chunks} chunks upserted ==="
        )

    def _process_pathway(
        self, country: str, visa_type: str, cfg: dict
    ) -> tuple[int, int]:
        sources_processed = 0
        chunks_upserted = 0

        for url in cfg["urls"]:
            logger.info(f"Fetching: {url}")
            markdown = self.fetch_markdown(url, crawl_depth=cfg.get("crawl_depth", 0))

            if not markdown:
                logger.warning(f"Empty content returned for {url} — skipping")
                continue

            content_hash = compute_hash(markdown)

            # Check if content changed since last scrape
            try:
                existing = (
                    self.supabase.table("immigration_sources")
                    .select("id, content_hash")
                    .eq("source_url", url)
                    .eq("is_active", True)
                    .execute()
                )
            except Exception as e:
                logger.error(f"Supabase query failed for {url}: {e}")
                continue

            if existing.data and existing.data[0]["content_hash"] == content_hash:
                logger.info(f"No change detected for {url} — skipping re-embedding")
                continue

            logger.info(f"Content changed (or new) for {url} — processing")

            # Write raw source to Supabase
            try:
                source_id = upsert_source(
                    supabase=self.supabase,
                    country=country,
                    visa_type=visa_type,
                    source_url=url,
                    raw_markdown=markdown,
                    content_hash=content_hash,
                )
            except Exception as e:
                logger.error(f"Failed to upsert source for {url}: {e}")
                continue

            # Chunk the markdown
            chunks = chunk_markdown(
                text=markdown,
                chunk_size=512,
                chunk_overlap=64,
                metadata={
                    "country": country,
                    "visa_type": visa_type,
                    "source_url": url,
                },
            )
            logger.info(f"Generated {len(chunks)} chunks for {url}")

            # Embed all chunks
            try:
                embedded_chunks = embed_chunks(chunks)
            except Exception as e:
                logger.error(f"Embedding failed for {url}: {e}")
                continue

            # Delete old chunks and insert new ones
            try:
                self.supabase.table("immigration_chunks").delete().eq(
                    "source_id", source_id
                ).execute()
                upsert_chunks(self.supabase, source_id, country, visa_type, embedded_chunks)
            except Exception as e:
                logger.error(f"Chunk upsert failed for {url}: {e}")
                continue

            logger.info(f"Upserted {len(embedded_chunks)} chunks for {url}")
            sources_processed += 1
            chunks_upserted += len(embedded_chunks)

        return sources_processed, chunks_upserted


if __name__ == "__main__":
    PathwayScraper().run()
