"""Parser for IRCC Express Entry pool snapshots.

Handles two source formats:
  1. CKAN CSV resources (structured, preferred)
  2. HTML results page tables (fallback)

Both produce dicts compatible with the ee_pool_snapshots schema:
  snapshot_date, total_candidates, by_program (JSONB), crs_distribution (JSONB), source_url
"""
import csv
import io
import re
from datetime import date, datetime
from typing import Optional

from bs4 import BeautifulSoup, Tag
from utils.logger import get_logger

logger = get_logger(__name__)


def parse_ckan_csv(csv_text: str, source_url: str, cfg: dict) -> list[dict]:
    """Parse a CKAN CSV file containing EE pool CRS distribution data.

    Accepts both long format (one row per score band per date) and wide format
    (one row per date, score bands as columns).

    Long format columns (case-insensitive):
      date/snapshot_date, score_band/crs_band, candidates/count/profiles

    Wide format: first column is date, remaining columns are score-band labels.
    """
    reader = csv.DictReader(io.StringIO(csv_text))
    if not reader.fieldnames:
        logger.warning(f"Empty CSV from {source_url}")
        return []

    fieldnames = [f.strip() for f in reader.fieldnames]

    # Detect format by inspecting column names
    date_col = _find_col(fieldnames, ["date", "snapshot_date", "snapshotdate", "period"])
    band_col = _find_col(fieldnames, ["score_band", "crs_band", "band", "scoreband"])
    count_col = _find_col(fieldnames, ["candidates", "count", "profiles", "total", "number"])

    rows = list(reader)
    if not rows:
        return []

    if date_col and band_col and count_col:
        return _parse_long_format(rows, date_col, band_col, count_col, source_url, cfg)

    if date_col:
        return _parse_wide_format(rows, fieldnames, date_col, source_url, cfg)

    logger.warning(f"Could not detect CSV format for {source_url} — columns: {fieldnames}")
    return []


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


# ─── Long-format CSV ────────────────────────────────────────────────────────

def _parse_long_format(
    rows: list[dict],
    date_col: str,
    band_col: str,
    count_col: str,
    source_url: str,
    cfg: dict,
) -> list[dict]:
    """Group long-format rows by date into one snapshot record per date."""
    grouped: dict[str, dict[str, int]] = {}
    totals: dict[str, int] = {}

    for row in rows:
        raw_date = row.get(date_col, "").strip()
        snap_date = _parse_date(raw_date)
        if not snap_date:
            continue

        date_key = snap_date.isoformat()
        band = _normalise_band(row.get(band_col, "").strip())
        raw_count = row.get(count_col, "").strip().replace(",", "")
        if not raw_count.isdigit():
            continue
        count = int(raw_count)

        grouped.setdefault(date_key, {})[band] = count
        totals[date_key] = totals.get(date_key, 0) + count

    return [
        {
            "snapshot_date": dt,
            "total_candidates": totals.get(dt),
            "by_program": None,
            "crs_distribution": grouped[dt],
            "source_url": source_url,
        }
        for dt in sorted(grouped)
    ]


# ─── Wide-format CSV ────────────────────────────────────────────────────────

def _parse_wide_format(
    rows: list[dict],
    fieldnames: list[str],
    date_col: str,
    source_url: str,
    cfg: dict,
) -> list[dict]:
    """Parse wide-format CSV where columns are score bands."""
    band_cols = [f for f in fieldnames if f != date_col and _looks_like_band(f)]
    if not band_cols:
        logger.warning(f"Wide CSV has no identifiable score-band columns in {source_url}")
        return []

    snapshots: list[dict] = []
    for row in rows:
        raw_date = row.get(date_col, "").strip()
        snap_date = _parse_date(raw_date)
        if not snap_date:
            continue

        crs_dist: dict[str, int] = {}
        total = 0
        for col in band_cols:
            raw = row.get(col, "").strip().replace(",", "")
            if raw.isdigit():
                crs_dist[_normalise_band(col)] = int(raw)
                total += int(raw)

        if not crs_dist:
            continue

        snapshots.append({
            "snapshot_date": snap_date.isoformat(),
            "total_candidates": total or None,
            "by_program": None,
            "crs_distribution": crs_dist,
            "source_url": source_url,
        })

    return snapshots


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

def _find_col(fieldnames: list[str], candidates: list[str]) -> Optional[str]:
    """Return the first fieldname that contains any of the candidate substrings."""
    fl = [f.lower() for f in fieldnames]
    for candidate in candidates:
        for i, f in enumerate(fl):
            if candidate in f:
                return fieldnames[i]
    return None


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
