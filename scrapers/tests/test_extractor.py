"""
Unit tests for scrapers/extractor.py.

Tests extract_pathway_metadata() in isolation using a mock Anthropic client.
No real network calls, no Supabase writes.
"""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from extractor import extract_pathway_metadata, CANADA_VISA_TYPE_MAP, PathwayExtractionResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_anthropic_mock(response_text: str) -> MagicMock:
    """Return a mock Anthropic client that returns response_text from messages.create."""
    content_block = MagicMock()
    content_block.text = response_text

    message = MagicMock()
    message.content = [content_block]

    client = MagicMock()
    client.messages.create.return_value = message
    return client


FSW_CHUNKS = [
    """
Federal Skilled Worker Program eligibility requirements.

To be eligible, you must:
- Score at least 67 points on the selection factors
- Have at least 1 year of continuous full-time skilled work experience (NOC TEER 0, 1, 2, or 3)
- Achieve Canadian Language Benchmark (CLB) 7 in all four language abilities:
  listening, reading, writing, and speaking
- Have your foreign educational credentials assessed (ECA required)
- No specific age requirement, but CRS score is affected by age

Processing times: 6 months to 12 months.
""",
    """
Points-based selection. The Comprehensive Ranking System (CRS) allocates points.
Draws are conducted regularly and cut-off scores vary.

Key benefits:
- No job offer required
- Includes spouse or common-law partner
- Pathway to permanent residency

Key limitations:
- CRS cut-off varies by draw
- Competitive — high CLB scores help significantly
""",
]

CEC_CHUNKS = [
    """
Canadian Experience Class (CEC) eligibility.

You must have at least 1 year of skilled work experience in Canada within the
last 3 years (NOC TEER 0, 1, 2, or 3). Canadian work experience is required.

Language requirements:
- NOC TEER 0 or 1: CLB 7 in all abilities
- NOC TEER 2 or 3: CLB 5 in all abilities

Processing time: approximately 6 months.

No degree requirement — Canadian work experience replaces credential assessment.
ECA not required for CEC.
""",
]


# ---------------------------------------------------------------------------
# Test 1: FSW extraction asserts clb_min.listening >= 7
# ---------------------------------------------------------------------------


def test_extract_fsw_clb_min() -> None:
    """FSW extraction from real-style chunks must yield CLB 7 listening."""
    fsw_response = json.dumps(
        {
            "requires_degree": False,
            "min_years_experience": 1,
            "english_min_score": "CLB 7 all bands",
            "processing_time_min": "6 months",
            "processing_time_max": "12 months",
            "additional_rules": {
                "clb_min": {
                    "listening": 7,
                    "reading": 7,
                    "writing": 7,
                    "speaking": 7,
                },
                "noc_teer_eligible": [0, 1, 2, 3],
                "eca_required": True,
                "age_max": None,
                "canadian_work_required": False,
                "canadian_work_min_years": 0,
                "job_offer_required": False,
                "provincial_nomination_eligible": True,
                "points_based": True,
                "key_benefits": ["No job offer required", "Includes spouse"],
                "key_limitations": ["CRS cut-off varies", "Competitive"],
                "recent_changes": [],
                "source_urls": [],
            },
        }
    )
    client = _make_anthropic_mock(fsw_response)
    cfg = CANADA_VISA_TYPE_MAP["express_entry_fsw"]

    result = extract_pathway_metadata(
        visa_type="express_entry_fsw",
        chunks=FSW_CHUNKS,
        pathway_config=cfg,
        anthropic_client=client,
    )

    assert isinstance(result, PathwayExtractionResult)
    assert result.english_min_score == "CLB 7 all bands"
    clb = result.additional_rules["clb_min"]
    assert clb["listening"] >= 7
    assert clb["reading"] >= 7
    assert clb["writing"] >= 7
    assert clb["speaking"] >= 7
    assert result.requires_degree is False
    assert result.additional_rules["eca_required"] is True


# ---------------------------------------------------------------------------
# Test 2: CEC extraction asserts canadian_work_required == True
# ---------------------------------------------------------------------------


def test_extract_cec_canadian_work_required() -> None:
    """CEC extraction must identify that Canadian work experience is required."""
    cec_response = json.dumps(
        {
            "requires_degree": False,
            "min_years_experience": 1,
            "english_min_score": "CLB 7 (TEER 0/1) or CLB 5 (TEER 2/3)",
            "processing_time_min": "6 months",
            "processing_time_max": "6 months",
            "additional_rules": {
                "clb_min": {
                    "listening": 7,
                    "reading": 7,
                    "writing": 7,
                    "speaking": 7,
                },
                "noc_teer_eligible": [0, 1, 2, 3],
                "eca_required": False,
                "age_max": None,
                "canadian_work_required": True,
                "canadian_work_min_years": 1,
                "job_offer_required": False,
                "provincial_nomination_eligible": True,
                "points_based": True,
                "key_benefits": ["Fast processing", "No ECA required"],
                "key_limitations": ["Must have Canadian work experience"],
                "recent_changes": [],
                "source_urls": [],
            },
        }
    )
    client = _make_anthropic_mock(cec_response)
    cfg = CANADA_VISA_TYPE_MAP["express_entry_cec"]

    result = extract_pathway_metadata(
        visa_type="express_entry_cec",
        chunks=CEC_CHUNKS,
        pathway_config=cfg,
        anthropic_client=client,
    )

    assert result.additional_rules["canadian_work_required"] is True
    assert result.additional_rules["canadian_work_min_years"] >= 1
    assert result.additional_rules["eca_required"] is False
    assert result.requires_degree is False


# ---------------------------------------------------------------------------
# Test 3: Invalid JSON from Claude raises ValueError
# ---------------------------------------------------------------------------


def test_invalid_json_raises_value_error() -> None:
    """When Claude returns unparseable JSON, extract_pathway_metadata raises ValueError."""
    client = _make_anthropic_mock("This is not valid JSON at all { broken")
    cfg = CANADA_VISA_TYPE_MAP["express_entry_fsw"]

    with pytest.raises(ValueError, match="JSON parse failed"):
        extract_pathway_metadata(
            visa_type="express_entry_fsw",
            chunks=FSW_CHUNKS,
            pathway_config=cfg,
            anthropic_client=client,
        )


# ---------------------------------------------------------------------------
# Test 4: Markdown-fenced JSON is parsed correctly
# ---------------------------------------------------------------------------


def test_markdown_fenced_json_is_stripped() -> None:
    """Claude sometimes wraps JSON in ```json ... ``` — the extractor must strip fences."""
    payload = {
        "requires_degree": False,
        "min_years_experience": 0,
        "english_min_score": None,
        "processing_time_min": None,
        "processing_time_max": None,
        "additional_rules": {
            "clb_min": None,
            "noc_teer_eligible": None,
            "eca_required": False,
            "age_max": None,
            "canadian_work_required": False,
            "canadian_work_min_years": 0,
            "job_offer_required": False,
            "provincial_nomination_eligible": False,
            "points_based": False,
            "key_benefits": [],
            "key_limitations": [],
            "recent_changes": [],
            "source_urls": [],
        },
    }
    fenced = f"```json\n{json.dumps(payload)}\n```"
    client = _make_anthropic_mock(fenced)
    cfg = CANADA_VISA_TYPE_MAP["bowp"]

    result = extract_pathway_metadata(
        visa_type="bowp",
        chunks=["Bridging Open Work Permit documentation."],
        pathway_config=cfg,
        anthropic_client=client,
    )

    assert result.requires_degree is False
    assert result.english_min_score is None


# ---------------------------------------------------------------------------
# Test 5: Pydantic validation failure raises ValueError with field info
# ---------------------------------------------------------------------------


def test_pydantic_validation_failure_raises_value_error() -> None:
    """When Claude returns JSON with wrong types, Pydantic raises a clear ValueError."""
    bad_payload = json.dumps(
        {
            "requires_degree": "yes",  # should be bool
            "min_years_experience": "three",  # should be int
            "english_min_score": None,
            "processing_time_min": None,
            "processing_time_max": None,
            "additional_rules": {},
        }
    )
    client = _make_anthropic_mock(bad_payload)
    cfg = CANADA_VISA_TYPE_MAP["pgwp"]

    with pytest.raises(ValueError, match="Pydantic validation failed"):
        extract_pathway_metadata(
            visa_type="pgwp",
            chunks=["PGWP documentation."],
            pathway_config=cfg,
            anthropic_client=client,
        )
