import re
from datetime import datetime
from typing import Optional

from utils.logger import get_logger

logger = get_logger(__name__)


def parse(markdown: str, cfg: dict) -> list[dict]:
    """
    Parse Canada Express Entry draw results from Firecrawl Markdown.

    The canada.ca rounds page uses a bullet list format, not a table:

        **Draw Type**

        - **Date and time:** May 25, 2026 at 15:22:56 UTC
        - **CRS score of lowest-ranked candidate invited:** 805
        - **Number of invitations issued:** 334
        - **Tie-breaking rule:** October 16, 2025 at 18:16:33 UTC

    This parser handles both the latest-round page and the historical
    ministerial instructions page (which uses a similar bullet format
    per round block).
    """
    draws: list[dict] = []

    date_pattern = re.compile(
        r'Date and time:\*\*\s*'
        r'(?P<date>[A-Z][a-z]+ \d{1,2},\s*\d{4})'
        r'\s+at\s+'
        r'(?P<time>\d{2}:\d{2}:\d{2})\s+UTC'
    )
    crs_pattern = re.compile(
        r'CRS score of lowest-ranked candidate invited:\*\*\s*(?P<crs>[\d,]+)'
    )
    invitations_pattern = re.compile(
        r'Number of invitations issued:\*\*\s*(?P<invitations>[\d,]+)'
    )
    tie_pattern = re.compile(
        r'Tie-breaking rule:\*\*\s*'
        r'(?P<date>[A-Z][a-z]+ \d{1,2},\s*\d{4})'
        r'\s+at\s+'
        r'(?P<time>\d{2}:\d{2}:\d{2})\s+UTC'
    )
    header_pattern = re.compile(r'\*\*(?P<type>[^*\n]{3,80})\*\*\n')

    for header_match in header_pattern.finditer(markdown):
        draw_type_raw = header_match.group("type").strip()

        if not _is_draw_type(draw_type_raw):
            continue

        start = header_match.end()
        block = markdown[start : start + 500]

        date_m = date_pattern.search(block)
        crs_m = crs_pattern.search(block)
        inv_m = invitations_pattern.search(block)

        if not (date_m and crs_m and inv_m):
            continue

        try:
            draw_date = datetime.strptime(
                f"{date_m.group('date').strip()} {date_m.group('time')}",
                "%B %d, %Y %H:%M:%S"
            ).date()
        except ValueError:
            logger.warning(f"Could not parse date from block near: {draw_type_raw}")
            continue

        tie_m = tie_pattern.search(block)
        tie_breaking = None
        if tie_m:
            try:
                tie_dt = datetime.strptime(
                    f"{tie_m.group('date').strip()} {tie_m.group('time')}",
                    "%B %d, %Y %H:%M:%S"
                )
                tie_breaking = tie_dt.isoformat() + "Z"
            except ValueError:
                pass

        draws.append({
            "country": cfg["country"],
            "program": cfg["program"],
            "draw_date": draw_date.isoformat(),
            "round_number": None,  # not present on this page format
            "draw_type": _normalize_draw_type(draw_type_raw),
            "invitations_issued": int(inv_m.group("invitations").replace(",", "")),
            "cutoff_score": int(crs_m.group("crs").replace(",", "")),
            "tie_breaking_date": tie_breaking,
            "source_url": cfg["url"],
            "raw_data": {"raw_type": draw_type_raw},
        })

    logger.info(f"Canada draws parser found {len(draws)} draw records")
    return draws


def _is_draw_type(text: str) -> bool:
    """Return True if the bold text looks like a draw type name, not a nav or table header."""
    if ":" in text:
        return False
    if "http" in text.lower() or "[" in text:
        return False
    if len(text) < 3 or len(text) > 80:
        return False
    keywords = [
        "nominee", "provincial", "general", "french", "stem",
        "healthcare", "trade", "transport", "agriculture",
        "skilled worker", "experience class", "no program"
    ]
    text_lower = text.lower()
    return any(kw in text_lower for kw in keywords)


def _normalize_draw_type(raw: str) -> str:
    mapping = {
        "provincial nominee program": "pnp",
        "no program specified": "general",
        "general": "general",
        "canadian experience class": "cec",
        "federal skilled worker": "fsw",
        "federal skilled trades": "fst",
        "french language proficiency": "french_language",
        "stem occupations": "stem",
        "healthcare occupations": "healthcare",
        "trade occupations": "trades",
        "agriculture and agri-food occupations": "agriculture",
        "transport occupations": "transport",
    }
    return mapping.get(raw.lower().strip(), raw.lower().strip().replace(" ", "_"))
