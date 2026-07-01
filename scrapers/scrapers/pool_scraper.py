"""Scraper for Express Entry pool snapshots.

Sources (in order):
  1. IRCC rounds JSON — the same document the draws scraper uses carries the
     CRS pool distribution per round (dd1–dd18 + drawDistributionAsOn)
  2. HTML results page — fallback HTML table scrape

Inserts into ee_pool_snapshots on conflict (snapshot_date) → update,
so re-runs are idempotent.
"""
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


class PoolScraper(BaseScraper):
    def __init__(self) -> None:
        super().__init__()
        config_path = Path(__file__).parent.parent / "config" / "sources.yaml"
        with open(config_path) as f:
            config = yaml.safe_load(f)
        self.config: dict = config.get("pool_snapshots", {})

    def run(self) -> int:
        """Run all pool snapshot sources and return total rows inserted."""
        logger.info("=== Pool Scraper started ===")
        total_inserted = 0

        for source_key, cfg in self.config.items():
            logger.info(f"Processing pool source: {source_key}")
            inserted = self._process_source(cfg)
            total_inserted += inserted

        logger.info(f"=== Pool Scraper finished | {total_inserted} pool snapshots inserted ===")
        return total_inserted

    def _process_source(self, cfg: dict) -> int:
        """Dispatch to rounds-JSON or HTML fetch depending on config keys present."""
        try:
            parser_module = importlib.import_module(f"parsers.{cfg['parser']}")
        except ImportError as e:
            logger.error(f"Parser not found: parsers.{cfg['parser']} — {e}")
            return 0

        snapshots: list[dict] = []

        if "json_url" in cfg:
            snapshots = self._fetch_rounds_json(cfg, parser_module)
        elif "url" in cfg:
            snapshots = self._fetch_html(cfg, parser_module)

        if not snapshots:
            logger.warning(f"No pool snapshots parsed from {cfg.get('url') or cfg.get('json_url')}")
            return 0

        return self._upsert_snapshots(snapshots, cfg)

    # ─── Rounds-JSON path ────────────────────────────────────────────────────

    def _fetch_rounds_json(self, cfg: dict, parser_module: object) -> list[dict]:
        """Fetch the IRCC rounds JSON and derive pool snapshots from its dd fields."""
        url = cfg["json_url"]
        json_text = self._fetch_text(url)
        if not json_text:
            return []

        parsed = parser_module.parse_rounds_json(json_text, url, cfg)  # type: ignore[attr-defined]
        logger.info(f"Parsed {len(parsed)} snapshots from rounds JSON: {url}")
        return parsed

    # ─── HTML path ───────────────────────────────────────────────────────────

    def _fetch_html(self, cfg: dict, parser_module: object) -> list[dict]:
        """Fetch raw HTML and delegate to parser."""
        url = cfg["url"]
        html = self._fetch_text(url)
        if not html:
            return []

        parsed = parser_module.parse_html(html, url, cfg)  # type: ignore[attr-defined]
        logger.info(f"Parsed {len(parsed)} snapshots from HTML: {url}")
        return parsed

    # ─── Shared fetch ────────────────────────────────────────────────────────

    @staticmethod
    def _fetch_text(url: str) -> Optional[str]:
        """Fetch a URL via curl_cffi with Chrome TLS impersonation; return body text."""
        from curl_cffi.requests import get as cffi_get

        logger.info(f"Fetching pool data: {url}")
        try:
            resp = cffi_get(url, impersonate="chrome136", timeout=60)
        except Exception as e:
            logger.error(f"Fetch failed for {url}: {e}")
            return None

        if resp.status_code != 200:
            logger.error(f"HTTP {resp.status_code} fetching {url}")
            return None

        return resp.text

    # ─── DB upsert ───────────────────────────────────────────────────────────

    def _upsert_snapshots(self, snapshots: list[dict], cfg: dict) -> int:
        """Batch-upsert snapshots into ee_pool_snapshots, skipping existing dates."""
        # Fetch existing snapshot dates to classify inserts vs skips
        existing_dates: set[str] = set()
        try:
            result = self.supabase.table("ee_pool_snapshots").select("snapshot_date").execute()
            existing_dates = {row["snapshot_date"] for row in result.data}
        except Exception as e:
            logger.warning(f"Could not pre-fetch existing snapshot dates: {e}")

        new_snapshots = [s for s in snapshots if s["snapshot_date"] not in existing_dates]
        skipped = len(snapshots) - len(new_snapshots)

        inserted = 0
        batch_size = 500
        for i in range(0, len(new_snapshots), batch_size):
            batch = new_snapshots[i : i + batch_size]
            try:
                self.supabase.table("ee_pool_snapshots").upsert(
                    batch,
                    on_conflict="snapshot_date",
                ).execute()
                inserted += len(batch)
            except Exception as e:
                logger.error(
                    f"Failed to upsert snapshot batch {i // batch_size + 1} "
                    f"({len(batch)} rows): {e}"
                )

        logger.info(f"Pool snapshots — inserted={inserted} skipped={skipped}")
        return inserted


if __name__ == "__main__":
    PoolScraper().run()
