import asyncio
import os
from abc import ABC, abstractmethod
from typing import Optional

from dotenv import load_dotenv
from supabase import create_client, Client

from utils.logger import get_logger

load_dotenv()
logger = get_logger(__name__)


class BaseScraper(ABC):
    def __init__(self) -> None:
        supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SECRET_KEY")

        if not all([supabase_url, supabase_key]):
            raise EnvironmentError(
                "Missing required environment variables. "
                "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are set."
            )

        self.supabase: Client = create_client(supabase_url, supabase_key)

    def fetch_markdown(self, url: str, crawl_depth: int = 0) -> Optional[str]:
        """
        Fetch a URL via Crawl4AI and return clean LLM-optimized Markdown.
        Uses Playwright headless Chromium — handles JavaScript rendering.
        When crawl_depth > 0, follows internal links automatically.
        """
        try:
            return asyncio.run(self._fetch_async(url, crawl_depth))
        except Exception as e:
            logger.error(f"fetch_markdown failed for {url}: {e}")
            return None

    async def _fetch_async(
        self, url: str, crawl_depth: int = 0
    ) -> Optional[str]:
        # Import here to avoid issues with asyncio event loop at module level
        from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
        from crawl4ai.content_filter_strategy import BM25ContentFilter
        from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator

        browser_config = BrowserConfig(
            headless=True,
            verbose=False,
            java_script_enabled=True,
        )

        # BM25 filter removes navigation, footers, cookie banners, and
        # other boilerplate — keeps only immigration-relevant content
        content_filter = BM25ContentFilter(
            user_query=(
                "immigration visa permit residency canada express entry "
                "eligibility requirements documents application"
            ),
            bm25_threshold=1.0,
        )

        run_config = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            markdown_generator=DefaultMarkdownGenerator(
                content_filter=content_filter,
                options={"ignore_links": False},
            ),
            page_timeout=30000,   # 30s per page
            wait_until="networkidle",
        )

        try:
            async with AsyncWebCrawler(config=browser_config) as crawler:
                if crawl_depth > 0:
                    # Deep crawl: discover all sub-pages automatically
                    from crawl4ai.deep_crawling import BFSDeepCrawlStrategy

                    strategy = BFSDeepCrawlStrategy(
                        max_depth=crawl_depth,
                        max_pages=40,
                        include_patterns=[
                            r".*canada\.ca.*immigration.*",
                            r".*ontario\.ca.*immigr.*",
                            r".*canada\.ca.*citizenship.*",
                        ],
                        exclude_patterns=[
                            r".*\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip)$",
                            r".*/contact.*",
                            r".*/search.*",
                            r".*/404.*",
                        ],
                    )

                    run_config_deep = CrawlerRunConfig(
                        cache_mode=CacheMode.BYPASS,
                        markdown_generator=DefaultMarkdownGenerator(
                            content_filter=content_filter,
                            options={"ignore_links": False},
                        ),
                        page_timeout=30000,
                        wait_until="networkidle",
                        deep_crawl_strategy=strategy,
                    )

                    results = await crawler.arun(url=url, config=run_config_deep)

                    # arun with deep crawl returns a list
                    if isinstance(results, list):
                        pages = [r for r in results if r.success and r.markdown]
                    else:
                        pages = [results] if results.success and results.markdown else []

                    if not pages:
                        logger.warning(f"Deep crawl returned 0 pages for {url}")
                        return None

                    combined = "\n\n---\n\n".join(
                        f"## Source: {r.url}\n\n"
                        + (r.markdown.fit_markdown
                           if hasattr(r.markdown, 'fit_markdown') and r.markdown.fit_markdown
                           else str(r.markdown))
                        for r in pages
                    )
                    logger.info(
                        f"Deep crawl found {len(pages)} pages from {url}"
                    )
                    return combined or None

                else:
                    # Single page scrape
                    result = await crawler.arun(url=url, config=run_config)

                    if not result.success:
                        logger.error(
                            f"Crawl4AI failed for {url}: {result.error_message}"
                        )
                        return None

                    markdown = (
                        result.markdown.fit_markdown
                        if hasattr(result.markdown, 'fit_markdown')
                           and result.markdown.fit_markdown
                        else str(result.markdown)
                    )
                    return markdown or None

        except Exception as e:
            logger.error(f"Crawl4AI error for {url}: {e}")
            return None

    @abstractmethod
    def run(self) -> None:
        pass
