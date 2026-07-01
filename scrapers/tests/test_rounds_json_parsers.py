"""
Unit tests for the direct rounds-JSON parsing paths added to
parsers/canada_draws.py and parsers/canada_pool_snapshots.py.

Uses inline fixtures shaped like the live IRCC document
(ee_rounds_123_en.json). No network calls, no Supabase writes.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from parsers.canada_draws import parse_rounds_json as parse_draws
from parsers.canada_pool_snapshots import parse_rounds_json as parse_pool

CFG = {
    "country": "canada",
    "program": "express_entry",
    "url": "https://example.canada.ca/rounds-invitations.html",
}

POOL_URL = "https://example.canada.ca/ee_rounds_123_en.json"


def _round(
    number: str = "422",
    date: str = "2026-06-25",
    name: str = "Healthcare and Social Services Occupations, 2026-Version 3",
    size: str = "4,000",
    crs: str = "475",
    cutoff: str = "May 21, 2026 at  12:14:09 UTC",
    as_on: str = "June 21, 2026",
    dd18: str = "239,645",
) -> dict:
    """Build a rounds-JSON object with realistic field shapes."""
    rd = {
        "drawNumber": number,
        "drawDate": date,
        "drawName": name,
        "drawSize": size,
        "drawCRS": crs,
        "drawCutOff": cutoff,
        "drawDistributionAsOn": as_on,
        "dd18": dd18,
    }
    for i in range(1, 18):
        rd[f"dd{i}"] = "1,000"
    return rd


# ---------------------------------------------------------------------------
# canada_draws.parse_rounds_json
# ---------------------------------------------------------------------------


def test_draws_happy_path() -> None:
    doc = json.dumps({"rounds": [_round(), _round(number="421", date="2026-06-24", name="Provincial Nominee Program")]})
    draws = parse_draws(doc, CFG)
    assert len(draws) == 2

    first = draws[0]
    assert first["country"] == "canada"
    assert first["program"] == "express_entry"
    assert first["draw_date"] == "2026-06-25"
    assert first["round_number"] == 422
    assert first["draw_type"] == "healthcare"
    assert first["invitations_issued"] == 4000
    assert first["cutoff_score"] == 475
    assert first["tie_breaking_date"] == "2026-05-21T12:14:09Z"
    assert first["raw_data"]["_unknown_type"] is False

    assert draws[1]["draw_type"] == "pnp"


def test_draws_skips_rounds_missing_date_or_scores() -> None:
    doc = json.dumps(
        {
            "rounds": [
                _round(date=""),
                _round(number="420", crs=""),
                _round(number="419", date="2026-06-20"),
            ]
        }
    )
    draws = parse_draws(doc, CFG)
    assert len(draws) == 1
    assert draws[0]["round_number"] == 419


def test_draws_flags_unknown_type() -> None:
    doc = json.dumps({"rounds": [_round(name="Underwater Basket Weaving Occupations")]})
    draws = parse_draws(doc, CFG)
    assert len(draws) == 1
    assert draws[0]["raw_data"]["_unknown_type"] is True


def test_draws_invalid_json_returns_empty() -> None:
    assert parse_draws("{not valid json", CFG) == []


# ---------------------------------------------------------------------------
# canada_pool_snapshots.parse_rounds_json
# ---------------------------------------------------------------------------


def test_pool_dedupes_by_distribution_date_keeping_newest_first() -> None:
    newest = _round(number="422", dd18="239,645")
    same_date = _round(number="421", date="2026-06-24", dd18="111,111")
    older = _round(number="417", date="2026-05-27", as_on="May 24, 2026", dd18="238,847")
    doc = json.dumps({"rounds": [newest, same_date, older]})

    snaps = parse_pool(doc, POOL_URL, CFG)
    assert len(snaps) == 2

    by_date = {s["snapshot_date"]: s for s in snaps}
    assert set(by_date) == {"2026-06-21", "2026-05-24"}
    # Rounds are newest-first; the first occurrence of a date wins
    assert by_date["2026-06-21"]["total_candidates"] == 239645
    assert by_date["2026-06-21"]["source_url"] == POOL_URL


def test_pool_distribution_uses_non_overlapping_bands() -> None:
    doc = json.dumps({"rounds": [_round()]})
    snaps = parse_pool(doc, POOL_URL, CFG)
    assert len(snaps) == 1

    dist = snaps[0]["crs_distribution"]
    # 15 non-overlapping bands; subtotals dd3/dd9 and grand total dd18 excluded
    assert len(dist) == 15
    assert "601-1200" in dist
    assert "0-300" in dist
    assert all(v == 1000 for v in dist.values())


def test_pool_skips_rounds_without_distribution() -> None:
    doc = json.dumps(
        {
            "rounds": [
                _round(number="23", date="2015-12-18", as_on="December 18, 2015", dd18="0"),
                _round(number="22", date="2015-12-04", as_on="", dd18=""),
            ]
        }
    )
    assert parse_pool(doc, POOL_URL, CFG) == []


def test_pool_invalid_json_returns_empty() -> None:
    assert parse_pool("[broken", POOL_URL, CFG) == []
