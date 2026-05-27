import asyncio
import os
import time
from abc import ABC, abstractmethod
from typing import Any, Optional

from dotenv import load_dotenv
from supabase import create_client, Client

from utils.logger import get_logger

load_dotenv()
logger = get_logger(__name__)

_DEFAULT_BM25_QUERY = (
    "immigration visa permit residency canada express entry "
    "eligibility requirements documents application"
)


class BaseScraper(ABC):
    def __init__(self) -> None:
        missing: list[str] = []
        supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SECRET_KEY")

        if not supabase_url:
            missing.append("NEXT_PUBLIC_SUPABASE_URL")
        if not supabase_key:
            missing.append("SUPABASE_SECRET_KEY")

        if missing:
            raise EnvironmentError(
                f"Missing required environment variables: {', '.join(missing)}"
            )

        self.supabase: Client = create_client(supabase_url, supabase_key)  # type: ignore[arg-type]

    def fetch_markdown(
        self,
        url: str,
        crawl_depth: int = 0,
        page_timeout: int = 30000,
        bm25_query: str = _DEFAULT_BM25_QUERY,
        use_browser: bool = True,
    ) -> Optional[str]:
        """
        Fetch a URL and return Markdown. Routes to plain HTTP or Playwright based on use_browser.
        HTTP path: single-page, no retries needed beyond the outer pipeline retry.
        Browser path: retries up to 2 times with exponential backoff (1s, 3s) on failure.
        """
        if not use_browser:
            return self._fetch_http(url)

        delays = [1, 3]
        for attempt in range(3):
            try:
                return asyncio.run(
                    self._fetch_async(url, crawl_depth, page_timeout, bm25_query)
                )
            except RuntimeError as e:
                # asyncio.run() cannot be called inside an already-running event loop
                logger.error(f"asyncio.run error for {url}: {e}", exc_info=True)
                return None
            except Exception as e:
                if attempt < 2:
                    delay = delays[attempt]
                    logger.warning(
                        f"fetch_markdown attempt {attempt + 1}/3 failed for {url}: "
                        f"{type(e).__name__}: {e} — retrying in {delay}s"
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        f"fetch_markdown failed after 3 attempts for {url}: "
                        f"{type(e).__name__}: {e}",
                        exc_info=True,
                    )
                    return None
        return None

    def _fetch_http(self, url: str) -> Optional[str]:
        """
        Plain HTTP fetch using curl_cffi — impersonates Chrome TLS to bypass Akamai WAF.
        For SSR government sites that block aiohttp/headless Chromium on TLS fingerprint.
        """
        from curl_cffi.requests import get as cffi_get
        from bs4 import BeautifulSoup

        try:
            response = cffi_get(url, impersonate="chrome136", timeout=30)
        except Exception as e:
            logger.error(f"_fetch_http failed for {url}: {type(e).__name__}: {e}")
            return None

        if response.status_code != 200:
            logger.error(f"HTTP {response.status_code} fetching {url}")
            return None

        soup = BeautifulSoup(response.text, "html.parser")
        content = (
            soup.find("main")
            or soup.find("div", id="wb-cont")
            or soup.find("article")
            or soup.find("body")
        )
        if content is None:
            return None

        for tag in content.find_all(["nav", "header", "footer", "script", "style"]):
            tag.decompose()

        return content.get_text(separator="\n", strip=True) or None

    async def _fetch_async(
        self,
        url: str,
        crawl_depth: int = 0,
        page_timeout: int = 30000,
        bm25_query: str = _DEFAULT_BM25_QUERY,
    ) -> Optional[str]:
        from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode  # noqa: F401
        from crawl4ai.content_filter_strategy import BM25ContentFilter
        from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator

        browser_config = BrowserConfig(
            headless=True,
            verbose=False,
            java_script_enabled=True,
            extra_args=["--disable-http2"],
        )

        content_filter = BM25ContentFilter(
            user_query=bm25_query,
            bm25_threshold=1.0,
        )

        markdown_generator = DefaultMarkdownGenerator(
            content_filter=content_filter,
            options={"ignore_links": False},
        )

        try:
            async with AsyncWebCrawler(config=browser_config) as crawler:
                if crawl_depth > 0:
                    return await self._deep_crawl(
                        crawler, url, crawl_depth, page_timeout, markdown_generator
                    )
                else:
                    return await self._single_page(
                        crawler, url, page_timeout, markdown_generator
                    )
        except Exception as e:
            logger.error(
                f"Crawl4AI session error for {url}: {type(e).__name__}: {e}",
                exc_info=True,
            )
            return None

    async def _single_page(
        self,
        crawler: Any,
        url: str,
        page_timeout: int,
        markdown_generator: Any,
    ) -> Optional[str]:
        """Fetch a single page and return its markdown."""
        from crawl4ai import CrawlerRunConfig, CacheMode

        run_config = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            markdown_generator=markdown_generator,
            page_timeout=page_timeout,
            wait_until="domcontentloaded",
        )

        result = await crawler.arun(url=url, config=run_config)

        if not result.success:
            logger.error(
                f"Crawl4AI failed for {url}: {result.error_message or 'unknown error'}"
            )
            return None

        return self._extract_markdown(result) or None

    async def _deep_crawl(
        self,
        crawler: Any,
        url: str,
        crawl_depth: int,
        page_timeout: int,
        markdown_generator: Any,
    ) -> Optional[str]:
        """BFS deep crawl. Falls back to single-page scrape if 0 pages are returned."""
        from crawl4ai import CrawlerRunConfig, CacheMode
        from crawl4ai.deep_crawling import BFSDeepCrawlStrategy

        strategy = BFSDeepCrawlStrategy(
            max_depth=crawl_depth,
            max_pages=40,
        )

        run_config_deep = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            markdown_generator=markdown_generator,
            page_timeout=page_timeout,
            wait_until="networkidle",
            deep_crawl_strategy=strategy,
        )

        results = await crawler.arun(url=url, config=run_config_deep)

        if isinstance(results, list):
            pages = [r for r in results if r.success and r.markdown]
        else:
            pages = [results] if results.success and results.markdown else []

        if not pages:
            logger.warning(
                f"Deep crawl returned 0 pages for {url} — falling back to single-page scrape"
            )
            return await self._single_page(crawler, url, page_timeout, markdown_generator)

        combined = "\n\n---\n\n".join(
            f"## Source: {r.url}\n\n{self._extract_markdown(r)}" for r in pages
        )
        logger.info(f"Deep crawl found {len(pages)} pages from {url}")
        return combined or None

    @staticmethod
    def _extract_markdown(result: Any) -> str:
        """Extract fit_markdown if available, otherwise fall back to str(markdown)."""
        if hasattr(result.markdown, "fit_markdown") and result.markdown.fit_markdown:
            return result.markdown.fit_markdown
        return str(result.markdown)

    @abstractmethod
    def run(self) -> None:
        pass
