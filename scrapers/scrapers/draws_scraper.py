import importlib
import sys
from pathlib import Path
from typing import Optional

import yaml
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))

from scrapers.base import BaseScraper
from utils.logger import get_logger

load_dotenv()
logger = get_logger(__name__)


class DrawsScraper(BaseScraper):
    def __init__(self) -> None:
        super().__init__()
        config_path = Path(__file__).parent.parent / "config" / "sources.yaml"
        with open(config_path) as f:
            self.config: dict = yaml.safe_load(f)["draws"]

    def run(self) -> None:
        logger.info("=== Draws Scraper started ===")
        total_inserted = 0
        total_skipped = 0
        all_unknown_types: list[str] = []

        for draw_key, cfg in self.config.items():
            logger.info(f"Processing draw source: {draw_key}")
            inserted, skipped, unknown_types = self._process_draw(cfg)
            total_inserted += inserted
            total_skipped += skipped
            all_unknown_types.extend(unknown_types)

        # Run pool scraper and capture its count for the summary
        pool_inserted = 0
        try:
            from scrapers.pool_scraper import PoolScraper
            pool_inserted = PoolScraper().run()
        except Exception as e:
            logger.error(f"Pool scraper failed: {e}")

        logger.info("=== Draws Run Summary ===")
        logger.info(f"  Draws inserted (new): {total_inserted}")
        logger.info(f"  Draws skipped (existing): {total_skipped}")
        if all_unknown_types:
            unique_unknown = sorted(set(all_unknown_types))
            logger.warning(f"  Unknown draw types found ({len(unique_unknown)}): {unique_unknown}")
        else:
            logger.info("  Unknown draw types found: none")
        logger.info(f"  Pool snapshots inserted: {pool_inserted}")
        logger.info("=== Draws Scraper finished ===")

    def _fetch_raw_html(self, url: str) -> Optional[str]:
        """Fetch raw HTML using curl_cffi with Chrome TLS impersonation."""
        from curl_cffi.requests import get as cffi_get

        try:
            response = cffi_get(url, impersonate="chrome136", timeout=30)
        except Exception as e:
            logger.error(f"_fetch_raw_html failed for {url}: {type(e).__name__}: {e}")
            return None

        if response.status_code != 200:
            logger.error(f"HTTP {response.status_code} fetching {url}")
            return None

        return response.text

    def _process_draw(self, cfg: dict) -> tuple[int, int, list[str]]:
        """Fetch, parse, and upsert draw records for one source.

        Returns (inserted, skipped, unknown_type_labels).
        """
        content_type = cfg.get("content_type", "markdown")
        if content_type == "html":
            content = self._fetch_raw_html(cfg["url"])
        else:
            content = self.fetch_markdown(cfg["url"])

        if not content:
            logger.warning(f"Empty content for {cfg['url']} — skipping")
            return 0, 0, []

        try:
            parser_module = importlib.import_module(f"parsers.{cfg['parser']}")
        except ImportError as e:
            logger.error(f"Parser not found: parsers.{cfg['parser']} — {e}")
            return 0, 0, []

        draws = parser_module.parse(content, cfg)

        if not draws:
            logger.warning(
                f"Parser returned 0 draws for {cfg['url']} — "
                "page structure may have changed"
            )
            return 0, 0, []

        # Fetch existing keys for this country/program to distinguish insert vs skip
        existing_keys: set[tuple[str, Optional[int]]] = set()
        try:
            result = (
                self.supabase.table("immigration_draws")
                .select("draw_date,round_number")
                .eq("country", cfg["country"])
                .eq("program", cfg["program"])
                .execute()
            )
            for row in result.data:
                existing_keys.add((row["draw_date"], row["round_number"]))
        except Exception as e:
            logger.warning(f"Could not pre-fetch existing draws: {e} — skipping dedup check")

        inserted = 0
        skipped = 0
        unknown_types: list[str] = []

        for draw in draws:
            key: tuple[str, Optional[int]] = (draw["draw_date"], draw.get("round_number"))

            if key in existing_keys:
                skipped += 1
                continue

            # For bullet-list draws without a round number, also check by date alone
            # to avoid inserting duplicates when round_number IS NULL (NULL≠NULL in Postgres)
            if key[1] is None:
                date_exists = any(k[0] == key[0] for k in existing_keys)
                if date_exists:
                    skipped += 1
                    continue

            try:
                self.supabase.table("immigration_draws").upsert(
                    draw,
                    on_conflict="country,program,draw_date,round_number",
                ).execute()
                inserted += 1
                existing_keys.add(key)

                raw_data = draw.get("raw_data", {})
                if raw_data.get("_unknown_type"):
                    unknown_types.append(raw_data.get("raw_type", draw["draw_type"]))

            except Exception as e:
                logger.error(f"Failed to upsert draw {draw}: {e}")

        logger.info(
            f"  [{cfg['program']}] inserted={inserted} skipped={skipped} "
            f"unknown_types={unknown_types or 'none'}"
        )
        return inserted, skipped, unknown_types


if __name__ == "__main__":
    DrawsScraper().run()
