import importlib
import sys
from pathlib import Path

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
        total_draws = 0

        for draw_key, cfg in self.config.items():
            logger.info(f"Processing draw source: {draw_key}")
            count = self._process_draw(cfg)
            total_draws += count

        logger.info(f"=== Draws Scraper finished | {total_draws} draws upserted ===")

    def _process_draw(self, cfg: dict) -> int:
        markdown = self.fetch_markdown(cfg["url"])
        if not markdown:
            logger.warning(f"Empty content for {cfg['url']} — skipping")
            return 0

        # Dynamically load the country-specific parser
        try:
            parser_module = importlib.import_module(f"parsers.{cfg['parser']}")
        except ImportError as e:
            logger.error(f"Parser not found: parsers.{cfg['parser']} — {e}")
            return 0

        draws = parser_module.parse(markdown, cfg)

        if not draws:
            logger.warning(
                f"Parser returned 0 draws for {cfg['url']} — "
                "page structure may have changed"
            )
            return 0

        upserted = 0
        for draw in draws:
            try:
                self.supabase.table("immigration_draws").upsert(
                    draw,
                    on_conflict="country,program,draw_date,round_number",
                ).execute()
                upserted += 1
            except Exception as e:
                logger.error(f"Failed to upsert draw {draw}: {e}")

        logger.info(f"Upserted {upserted}/{len(draws)} draws for {cfg['program']}")
        return upserted


if __name__ == "__main__":
    DrawsScraper().run()
