import re
from datetime import datetime
from typing import Optional

from utils.logger import get_logger

logger = get_logger(__name__)


def parse(markdown: str, cfg: dict) -> list[dict]:
    """
    Parse Australia SkillSelect invitation round results from Markdown.
    """
    draws: list[dict] = []

    # Australia SkillSelect table format:
    # | Month Year | Visa subclass | Invitations | Lowest points score |
    row_pattern = re.compile(
        r"\|\s*(?P<date>\w+ \d{4})\s*"
        r"\|\s*(?P<subclass>[^|]+?)\s*"
        r"\|\s*(?P<invitations>[\d,]+)\s*"
        r"\|\s*(?P<points>[\d,]+)\s*\|",
        re.MULTILINE,
    )

    for match in row_pattern.finditer(markdown):
        try:
            raw_date = match.group("date").strip()
            draw_date = datetime.strptime(raw_date, "%B %Y").date().replace(day=1)

            draws.append({
                "country": cfg["country"],
                "program": cfg["program"],
                "draw_date": draw_date.isoformat(),
                "round_number": None,  # Australia doesn't use round numbers
                "draw_type": match.group("subclass").strip().lower().replace(" ", "_"),
                "invitations_issued": int(
                    match.group("invitations").replace(",", "").strip()
                ),
                "cutoff_score": int(match.group("points").replace(",", "").strip()),
                "tie_breaking_date": None,
                "source_url": cfg["url"],
                "raw_data": {"raw_subclass": match.group("subclass").strip()},
            })
        except (ValueError, KeyError) as e:
            logger.warning(f"Could not parse AU row — {e}")
            continue

    logger.info(f"Australia draws parser found {len(draws)} draw records")
    return draws
