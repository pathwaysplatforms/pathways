import argparse
import os
import sys
from pathlib import Path
from typing import Optional

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

    def run(
        self,
        dry_run: bool = False,
        source_filter: Optional[str] = None,
    ) -> None:
        """Run the pathway scraper. Optionally dry-run or restrict to a single source key."""
        mode = "DRY RUN" if dry_run else "LIVE"
        logger.info(f"=== Pathway Scraper started [{mode}] ===")

        stats: dict = {
            "attempted": 0,
            "succeeded": 0,
            "failed": 0,
            "skipped": 0,
            "total_chunks": 0,
            "failures": [],
        }

        for country, visa_types in self.config.items():
            for visa_key, cfg in visa_types.items():
                source_key = f"{country}/{visa_key}"

                if source_filter and source_key != source_filter:
                    continue

                logger.info(f"Processing: {source_key}")
                self._process_pathway(country, visa_key, cfg, dry_run, stats)

        self._print_summary(stats, dry_run)

    def _process_pathway(
        self,
        country: str,
        visa_key: str,
        cfg: dict,
        dry_run: bool,
        stats: dict,
    ) -> None:
        """Process all URLs for a single pathway config entry."""
        source_key = f"{country}/{visa_key}"
        visa_type: str = cfg.get("visa_type", visa_key)

        for url in cfg["urls"]:
            stats["attempted"] += 1
            logger.info(f"Fetching: {url}")

            markdown = self.fetch_markdown(url, crawl_depth=cfg.get("crawl_depth", 0))

            if not markdown:
                logger.warning(f"Empty content returned for {url} — skipping")
                stats["skipped"] += 1
                stats["failures"].append(
                    {
                        "source_key": source_key,
                        "url": url,
                        "reason": "Empty content returned by scraper",
                    }
                )
                continue

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

            if dry_run:
                token_count = sum(len(c["text"]) // 4 for c in chunks)
                logger.info(
                    f"[DRY RUN] {url} → {len(chunks)} chunks, ~{token_count} tokens"
                )
                print(
                    f"  source_url:  {url}\n"
                    f"  chunk_count: {len(chunks)}\n"
                    f"  token_count: ~{token_count}\n"
                )
                stats["succeeded"] += 1
                stats["total_chunks"] += len(chunks)
                continue

            content_hash = compute_hash(markdown)

            try:
                existing = (
                    self.supabase.table("immigration_sources")
                    .select("id, content_hash")
                    .eq("source_url", url)
                    .eq("is_active", True)
                    .execute()
                )
            except Exception as e:
                logger.error(
                    f"Supabase query failed for {url}: {type(e).__name__}: {e}"
                )
                stats["failed"] += 1
                stats["failures"].append(
                    {
                        "source_key": source_key,
                        "url": url,
                        "reason": f"Supabase query error: {type(e).__name__}: {e}",
                    }
                )
                raise

            if existing.data and existing.data[0]["content_hash"] == content_hash:
                logger.info(f"No change detected for {url} — skipping re-embedding")
                stats["skipped"] += 1
                continue

            logger.info(f"Content changed (or new) for {url} — processing")

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
                logger.error(
                    f"Failed to upsert source for {url}: {type(e).__name__}: {e}"
                )
                stats["failed"] += 1
                stats["failures"].append(
                    {
                        "source_key": source_key,
                        "url": url,
                        "reason": f"Source upsert error: {type(e).__name__}: {e}",
                    }
                )
                raise

            try:
                embedded_chunks = embed_chunks(chunks)
            except Exception as e:
                logger.error(f"Embedding failed for {url}: {type(e).__name__}: {e}")
                stats["failed"] += 1
                stats["failures"].append(
                    {
                        "source_key": source_key,
                        "url": url,
                        "reason": f"Embedding error: {type(e).__name__}: {e}",
                    }
                )
                continue

            try:
                self.supabase.table("immigration_chunks").delete().eq(
                    "source_id", source_id
                ).execute()
                upsert_chunks(
                    self.supabase, source_id, country, visa_type, embedded_chunks
                )
            except Exception as e:
                logger.error(
                    f"Chunk upsert failed for {url}: {type(e).__name__}: {e}"
                )
                stats["failed"] += 1
                stats["failures"].append(
                    {
                        "source_key": source_key,
                        "url": url,
                        "reason": f"Chunk upsert error: {type(e).__name__}: {e}",
                    }
                )
                raise

            logger.info(f"Upserted {len(embedded_chunks)} chunks for {url}")
            stats["succeeded"] += 1
            stats["total_chunks"] += len(embedded_chunks)

    @staticmethod
    def _print_summary(stats: dict, dry_run: bool) -> None:
        """Print a structured run summary."""
        mode = "DRY RUN" if dry_run else "LIVE"
        print("\n" + "=" * 60)
        print(f"Pathway Scraper Summary [{mode}]")
        print("=" * 60)
        print(f"  Sources attempted : {stats['attempted']}")
        print(f"  Succeeded         : {stats['succeeded']}")
        print(f"  Failed            : {stats['failed']}")
        print(f"  Skipped           : {stats['skipped']}")
        print(f"  Total chunks      : {stats['total_chunks']}")
        if stats["failures"]:
            print("\n  Failed / Skipped URLs:")
            for entry in stats["failures"]:
                print(f"    [{entry['source_key']}] {entry['url']}")
                print(f"      reason: {entry['reason']}")
        print("=" * 60 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pathway scraper for immigration data")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scrape and chunk but do NOT upsert to Supabase — prints a summary instead",
    )
    parser.add_argument(
        "--source",
        metavar="KEY",
        help="Run a single source by its key, e.g. canada/express_entry",
    )
    args = parser.parse_args()

    PathwayScraper().run(dry_run=args.dry_run, source_filter=args.source)
