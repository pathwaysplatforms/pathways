"""Parser for IRCC Express Entry pool snapshots.

Handles two source formats:
  1. IRCC rounds JSON (primary) — each round carries the CRS pool distribution
     as of `drawDistributionAsOn` in fields dd1–dd18
  2. HTML results page tables (fallback)

Both produce dicts compatible with the ee_pool_snapshots schema:
  snapshot_date, total_candidates, by_program (JSONB), crs_distribution (JSONB), source_url
"""
import json
import re
from datetime import date, datetime
from typing import Optional

from bs4 import BeautifulSoup, Tag
from utils.logger import get_logger

logger = get_logger(__name__)

# Non-overlapping CRS bands in the rounds JSON. dd3 (451-500) and dd9 (401-450)
# are subtotals of the five bands that follow each of them, and dd18 is the
# grand total — verified against live data: dd3 = Σ(dd4..dd8),
# dd9 = Σ(dd10..dd14), dd18 = dd1+dd2+dd3+dd9+dd15+dd16+dd17.
_DD_BANDS: list[tuple[str, str]] = [
    ("dd1", "601-1200"),
    ("dd2", "501-600"),
    ("dd4", "491-500"),
    ("dd5", "481-490"),
    ("dd6", "471-480"),
    ("dd7", "461-470"),
    ("dd8", "451-460"),
    ("dd10", "441-450"),
    ("dd11", "431-440"),
    ("dd12", "421-430"),
    ("dd13", "411-420"),
    ("dd14", "401-410"),
    ("dd15", "351-400"),
    ("dd16", "301-350"),
    ("dd17", "0-300"),
]


def parse_rounds_json(json_text: str, source_url: str, cfg: dict) -> list[dict]:
    """Derive pool snapshots from the CRS distribution embedded in the IRCC
    rounds JSON. Multiple rounds can share one distribution date; the rounds
    list is newest-first, so the first occurrence of each date wins.
    Rounds without distribution data (dd18 missing or 0 — pre-2019) are skipped.
    """
    try:
        data = json.loads(json_text)
    except json.JSONDecodeError as exc:
        logger.error(f"Rounds JSON parse error for pool snapshots: {exc}")
        return []

    by_date: dict[str, dict] = {}

    for rd in data.get("rounds", []):
        total = _to_int(rd.get("dd18", ""))
        if total <= 0:
            continue

        snap_date = _parse_date(str(rd.get("drawDistributionAsOn", "")).strip())
        if not snap_date:
            continue

        date_key = snap_date.isoformat()
        if date_key in by_date:
            continue

        crs_dist = {
            label: _to_int(rd.get(field, ""))
            for field, label in _DD_BANDS
        }

        by_date[date_key] = {
            "snapshot_date": date_key,
            "total_candidates": total,
            "by_program": None,
            "crs_distribution": crs_dist,
            "source_url": source_url,
        }

    snapshots = [by_date[k] for k in sorted(by_date)]
    logger.info(f"Pool snapshots: {len(snapshots)} distinct distribution dates in rounds JSON")
    return snapshots


def parse_html(html: str, source_url: str, cfg: dict) -> list[dict]:
    """Parse HTML results page for any CRS distribution or pool size tables."""
    soup = BeautifulSoup(html, "html.parser")
    snapshots: list[dict] = []

    for table in soup.find_all("table"):
        if not isinstance(table, Tag):
            continue
        result = _parse_html_table(table, source_url, cfg)
        snapshots.extend(result)

    # Deduplicate by date (keep last)
    by_date: dict[str, dict] = {}
    for s in snapshots:
        by_date[s["snapshot_date"]] = s

    return list(by_date.values())


# ─── HTML table parser ───────────────────────────────────────────────────────

def _parse_html_table(table: Tag, source_url: str, cfg: dict) -> list[dict]:
    """Try to extract pool snapshot data from a single HTML <table>."""
    rows = table.find_all("tr")
    if len(rows) < 2:
        return []

    headers = [th.get_text(strip=True).lower() for th in rows[0].find_all(["th", "td"])]

    # Only process tables that look like they contain pool/distribution data
    has_date = any("date" in h or "period" in h for h in headers)
    has_band = any(_looks_like_band(h) for h in headers) or any("band" in h or "score" in h for h in headers)
    has_count = any(w in h for h in headers for w in ("candidate", "profile", "total", "count"))

    if not (has_date and (has_band or has_count)):
        return []

    date_idx = next((i for i, h in enumerate(headers) if "date" in h or "period" in h), None)
    if date_idx is None:
        return []

    snapshots: list[dict] = []

    for row in rows[1:]:
        cells = row.find_all(["td", "th"])
        texts = [c.get_text(strip=True) for c in cells]
        if len(texts) <= date_idx:
            continue

        snap_date = _parse_date(texts[date_idx])
        if not snap_date:
            continue

        crs_dist: dict[str, int] = {}
        total = None

        for i, h in enumerate(headers):
            if i == date_idx or i >= len(texts):
                continue
            val = texts[i].replace(",", "").strip()
            if not val.isdigit():
                continue
            if _looks_like_band(h):
                crs_dist[_normalise_band(h)] = int(val)
            elif any(w in h for w in ("total", "candidate", "profile")):
                total = int(val)

        snapshots.append({
            "snapshot_date": snap_date.isoformat(),
            "total_candidates": total,
            "by_program": None,
            "crs_distribution": crs_dist or None,
            "source_url": source_url,
        })

    return snapshots


# ─── Helpers ────────────────────────────────────────────────────────────────

def _to_int(text: str) -> int:
    """Parse an IRCC count string like '20,012' to int; non-numeric → 0."""
    cleaned = str(text).replace(",", "").strip()
    return int(cleaned) if cleaned.isdigit() else 0


def _looks_like_band(text: str) -> bool:
    """Return True if text looks like a CRS score-band label (e.g. '300-349', '601+')."""
    return bool(re.match(r"^\d{3}[-–]\d{3}$|^\d{3}\+$|^\d{3} ?[-–] ?\d{3}$", text.strip()))


def _normalise_band(raw: str) -> str:
    """Normalise score band to 'NNN-NNN' or 'NNN+' format."""
    raw = raw.strip()
    m = re.match(r"(\d{3})\s*[-–]\s*(\d{3})", raw)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    m2 = re.match(r"(\d{3})\+", raw)
    if m2:
        return f"{m2.group(1)}+"
    return raw


def _parse_date(text: str) -> Optional[date]:
    """Parse various date formats used in IRCC data."""
    text = text.strip()

    for fmt in ("%Y-%m-%d", "%B %d, %Y", "%b %d, %Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    # Quarter format: "Q1 2023" → first day of the quarter
    qm = re.match(r"Q([1-4])\s+(\d{4})", text)
    if qm:
        quarter_start_month = (int(qm.group(1)) - 1) * 3 + 1
        return date(int(qm.group(2)), quarter_start_month, 1)

    # "January 2023" → first day of month
    mm = re.match(r"([A-Z][a-z]+)\s+(\d{4})", text)
    if mm:
        try:
            return datetime.strptime(f"{mm.group(1)} {mm.group(2)}", "%B %Y").date().replace(day=1)
        except ValueError:
            pass

    return None
