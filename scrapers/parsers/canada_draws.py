import re
from datetime import datetime
from typing import Optional

from utils.logger import get_logger

logger = get_logger(__name__)


def parse(markdown: str, cfg: dict) -> list[dict]:
    """
    Parse Canada Express Entry draw results from Firecrawl Markdown output.
    Returns a list of draw dicts ready for Supabase insertion.
    """
    draws: list[dict] = []

    # Firecrawl renders HTML tables as Markdown tables.
    # Target format (columns may vary slightly):
    # | Date | Round number | Type | Invitations issued | CRS score | Tie-breaking rule |
    full_row = re.compile(
        r"\|\s*(?P<date>[A-Z][a-z]+ \d{1,2},\s*\d{4})\s*"
        r"\|\s*(?P<round>\d+)\s*"
        r"\|\s*(?P<type>[^|]+?)\s*"
        r"\|\s*(?P<invitations>[\d,]+)\s*"
        r"\|\s*(?P<crs>[\d,]+)\s*"
        r"\|\s*(?P<tie>[^|]+?)\s*\|",
        re.MULTILINE,
    )

    for match in full_row.finditer(markdown):
        try:
            raw_date = match.group("date").strip()
            draw_date = datetime.strptime(raw_date, "%B %d, %Y").date()

            draws.append({
                "country": cfg["country"],
                "program": cfg["program"],
                "draw_date": draw_date.isoformat(),
                "round_number": int(match.group("round").strip()),
                "draw_type": _normalize_draw_type(match.group("type").strip()),
                "invitations_issued": int(
                    match.group("invitations").replace(",", "").strip()
                ),
                "cutoff_score": int(match.group("crs").replace(",", "").strip()),
                "tie_breaking_date": _parse_tie_breaking(match.group("tie").strip()),
                "source_url": cfg["url"],
                "raw_data": {
                    "raw_type": match.group("type").strip(),
                    "raw_tie_breaking": match.group("tie").strip(),
                },
            })
        except (ValueError, KeyError, AttributeError) as e:
            logger.warning(f"Could not parse row — {e} — raw: {match.group(0)[:80]}")
            continue

    logger.info(f"Canada draws parser found {len(draws)} draw records")
    return draws


def _normalize_draw_type(raw: str) -> str:
    mapping: dict[str, str] = {
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
    return mapping.get(raw.lower(), "other")


def _parse_tie_breaking(raw: str) -> Optional[str]:
    pattern = re.compile(r"(\w+ \d{1,2}, \d{4}) at (\d{2}:\d{2}:\d{2}) UTC")
    m = pattern.search(raw)
    if m:
        try:
            dt = datetime.strptime(
                f"{m.group(1)} {m.group(2)}", "%B %d, %Y %H:%M:%S"
            )
            return dt.isoformat() + "Z"
        except ValueError:
            return None
    return None
