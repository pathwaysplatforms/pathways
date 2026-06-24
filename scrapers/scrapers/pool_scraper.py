"""Scraper for Express Entry pool snapshots.

Sources (in order):
  1. CKAN open data API — downloads all CSV resources for the EE CRS dataset
  2. HTML results page — fallback HTML table scrape

Inserts into ee_pool_snapshots on conflict (snapshot_date) → do nothing,
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
        """Dispatch to CKAN or HTML fetch depending on config keys present."""
        try:
            parser_module = importlib.import_module(f"parsers.{cfg['parser']}")
        except ImportError as e:
            logger.error(f"Parser not found: parsers.{cfg['parser']} — {e}")
            return 0

        snapshots: list[dict] = []

        if "ckan_api_url" in cfg:
            snapshots = self._fetch_ckan(cfg, parser_module)
        elif "url" in cfg:
            snapshots = self._fetch_html(cfg, parser_module)

        if not snapshots:
            logger.warning(f"No pool snapshots parsed from {cfg.get('url') or cfg.get('ckan_api_url')}")
            return 0

        return self._upsert_snapshots(snapshots, cfg)

    # ─── CKAN path ───────────────────────────────────────────────────────────

    def _fetch_ckan(self, cfg: dict, parser_module: object) -> list[dict]:
        """Hit the CKAN package_show API, then download and parse each CSV resource."""
        import json
        from curl_cffi.requests import get as cffi_get

        api_url = f"{cfg['ckan_api_url']}?id={cfg['ckan_dataset_id']}"
        logger.info(f"Fetching CKAN metadata: {api_url}")

        try:
            resp = cffi_get(api_url, impersonate="chrome136", timeout=30)
        except Exception as e:
            logger.error(f"CKAN API request failed: {e}")
            return []

        if resp.status_code != 200:
            logger.error(f"CKAN API returned HTTP {resp.status_code}")
            return []

        try:
            package = json.loads(resp.text)
        except json.JSONDecodeError as e:
            logger.error(f"CKAN API response is not valid JSON: {e}")
            return []

        if not package.get("success"):
            logger.warning(f"CKAN API success=false: {package.get('error')}")
            return []

        resources = package.get("result", {}).get("resources", [])
        csv_resources = [r for r in resources if r.get("format", "").upper() == "CSV"]

        if not csv_resources:
            logger.warning(f"No CSV resources found in CKAN dataset {cfg['ckan_dataset_id']}")
            return []

        logger.info(f"Found {len(csv_resources)} CSV resource(s) in CKAN dataset")
        all_snapshots: list[dict] = []

        for resource in csv_resources:
            url = resource.get("url", "")
            if not url:
                continue
            logger.info(f"  Downloading CSV: {url}")
            csv_text = self._download_csv(url)
            if not csv_text:
                continue

            parsed = parser_module.parse_ckan_csv(csv_text, url, cfg)  # type: ignore[attr-defined]
            logger.info(f"  Parsed {len(parsed)} snapshots from {url}")
            all_snapshots.extend(parsed)

        return all_snapshots

    def _download_csv(self, url: str) -> Optional[str]:
        """Download a CSV file via curl_cffi and return its text content."""
        from curl_cffi.requests import get as cffi_get

        try:
            resp = cffi_get(url, impersonate="chrome136", timeout=60)
        except Exception as e:
            logger.error(f"CSV download failed for {url}: {e}")
            return None

        if resp.status_code != 200:
            logger.error(f"HTTP {resp.status_code} downloading CSV {url}")
            return None

        return resp.text

    # ─── HTML path ───────────────────────────────────────────────────────────

    def _fetch_html(self, cfg: dict, parser_module: object) -> list[dict]:
        """Fetch raw HTML and delegate to parser."""
        from curl_cffi.requests import get as cffi_get

        url = cfg["url"]
        logger.info(f"Fetching HTML pool data: {url}")

        try:
            resp = cffi_get(url, impersonate="chrome136", timeout=30)
        except Exception as e:
            logger.error(f"HTML fetch failed for {url}: {e}")
            return []

        if resp.status_code != 200:
            logger.error(f"HTTP {resp.status_code} fetching {url}")
            return []

        parsed = parser_module.parse_html(resp.text, url, cfg)  # type: ignore[attr-defined]
        logger.info(f"Parsed {len(parsed)} snapshots from HTML: {url}")
        return parsed

    # ─── DB upsert ───────────────────────────────────────────────────────────

    def _upsert_snapshots(self, snapshots: list[dict], cfg: dict) -> int:
        """Upsert snapshots into ee_pool_snapshots, skipping existing dates."""
        # Fetch existing snapshot dates to classify inserts vs skips
        existing_dates: set[str] = set()
        try:
            result = self.supabase.table("ee_pool_snapshots").select("snapshot_date").execute()
            existing_dates = {row["snapshot_date"] for row in result.data}
        except Exception as e:
            logger.warning(f"Could not pre-fetch existing snapshot dates: {e}")

        inserted = 0
        skipped = 0

        for snap in snapshots:
            if snap["snapshot_date"] in existing_dates:
                skipped += 1
                continue
            try:
                self.supabase.table("ee_pool_snapshots").upsert(
                    snap,
                    on_conflict="snapshot_date",
                ).execute()
                inserted += 1
                existing_dates.add(snap["snapshot_date"])
            except Exception as e:
                logger.error(f"Failed to upsert snapshot {snap.get('snapshot_date')}: {e}")

        logger.info(f"Pool snapshots — inserted={inserted} skipped={skipped}")
        return inserted


if __name__ == "__main__":
    PoolScraper().run()
