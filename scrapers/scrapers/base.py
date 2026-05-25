import os
from abc import ABC, abstractmethod
from typing import Optional

from dotenv import load_dotenv
from firecrawl import FirecrawlApp
from supabase import create_client, Client

from utils.logger import get_logger

load_dotenv()

logger = get_logger(__name__)


class BaseScraper(ABC):
    def __init__(self) -> None:
        firecrawl_key = os.environ.get("FIRECRAWL_API_KEY")
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

        if not all([firecrawl_key, supabase_url, supabase_key]):
            raise EnvironmentError(
                "Missing required environment variables. "
                "Ensure FIRECRAWL_API_KEY, SUPABASE_URL, and "
                "SUPABASE_SERVICE_KEY are set."
            )

        self.firecrawl = FirecrawlApp(api_key=firecrawl_key)
        self.supabase: Client = create_client(supabase_url, supabase_key)

    def fetch_markdown(self, url: str, crawl_depth: int = 0) -> Optional[str]:
        """Fetch a URL via Firecrawl and return clean Markdown."""
        try:
            if crawl_depth > 0:
                result = self.firecrawl.crawl_url(
                    url,
                    params={
                        "limit": 20,
                        "maxDepth": crawl_depth,
                        "scrapeOptions": {"formats": ["markdown"]},
                    },
                )
                pages = result.get("data", [])
                if not pages:
                    logger.warning(f"Crawl returned 0 pages for {url}")
                    return None
                combined = "\n\n---\n\n".join(
                    f"## Source: {p['metadata'].get('sourceURL', url)}\n\n{p['markdown']}"
                    for p in pages
                    if p.get("markdown")
                )
                return combined or None
            else:
                result = self.firecrawl.scrape_url(
                    url,
                    params={"formats": ["markdown"]},
                )
                return result.get("markdown") or None
        except Exception as e:
            logger.error(f"Firecrawl error fetching {url}: {e}")
            return None

    @abstractmethod
    def run(self) -> None:
        pass
