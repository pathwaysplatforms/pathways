"""
Enrich Canada pathway_steps rows with IRCC-sourced structured data.

For each un-enriched (or stale) Canadian step:
  1. Scrape the IRCC processing-times and fees pages once per run.
  2. Pull up to 10 relevant immigration_chunks from Supabase for the pathway.
  3. Call claude-haiku-4-5-20251001 to extract structured fields as JSON.
  4. Upsert the extracted fields back to pathway_steps.

A row is stale when last_enriched_at is NULL or older than 7 days.
Exits cleanly if nothing needs enrichment.
"""
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))

import anthropic
from supabase import create_client, Client

from utils.logger import get_logger

load_dotenv()
logger = get_logger(__name__)

_PROCESSING_TIMES_URL = (
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/"
    "application/check-processing-times.html"
)
_FEES_URL = (
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/"
    "immigrate-canada/express-entry/apply-permanent-residence/fees.html"
)

_EXTRACTION_PROMPT = """\
You are an immigration data extraction assistant. Extract structured data from IRCC source material.

Step title: {title}
Step description: {description}
Pathway: {pathway_title}

IRCC source material (processing times, fees, general guidance):
---
{ircc_content}
---

Return ONLY valid JSON with exactly these fields (no preamble, no markdown fences, no explanation):
{{
  "official_url": <string or null>,
  "form_numbers": <array of strings like ["IMM 0008"] or null>,
  "fee_cad": <number or null>,
  "estimated_days_min": <integer or null>,
  "estimated_days_max": <integer or null>,
  "checklist_items": <array of 3-7 short action strings or null>,
  "pro_tips": <string of 1-3 sentences or null>
}}

Rules:
- official_url: the single IRCC page most directly relevant to completing THIS step.
- form_numbers: only include form numbers explicitly mentioned in the source material. If none found, return null.
- fee_cad: official IRCC fee in CAD for this specific step. Return null if the step is free or no fee is mentioned.
- estimated_days_min / estimated_days_max: processing time in calendar days per IRCC data. Return null if not found.
- checklist_items: ordered sub-tasks a user must complete to finish this step. Be specific and actionable.
- pro_tips: common pitfalls, timing advice, or easily-missed requirements grounded in the source. Return null if nothing notable.
- NEVER hallucinate form numbers, fees, or processing times. If a field cannot be confidently extracted from the provided source material, return null for that field.
"""


def _create_supabase() -> Client:
    """Create a Supabase service-role client from environment variables."""
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        raise EnvironmentError(
            "Missing required environment variables: "
            "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY"
        )
    return create_client(url, key)  # type: ignore[arg-type]


def _fetch_ircc_page(url: str) -> str:
    """Fetch an IRCC page with Chrome TLS impersonation; return plain text (max 8 000 chars)."""
    from curl_cffi.requests import get as cffi_get
    from bs4 import BeautifulSoup

    try:
        response = cffi_get(url, impersonate="chrome136", timeout=30)
    except Exception as exc:
        logger.error(f"Failed to fetch {url}: {exc}")
        return ""

    if response.status_code != 200:
        logger.error(f"HTTP {response.status_code} for {url}")
        return ""

    soup = BeautifulSoup(response.text, "html.parser")
    content = (
        soup.find("main")
        or soup.find("div", id="wb-cont")
        or soup.find("article")
        or soup.find("body")
    )
    if not content:
        return ""

    for tag in content.find_all(["nav", "header", "footer", "script", "style"]):
        tag.decompose()

    return content.get_text(separator="\n", strip=True)[:8000]


def _slug_to_visa_type(slug: str) -> str:
    """Derive an immigration_chunks visa_type from a pathway slug."""
    return slug.removeprefix("canada-").replace("-", "_")


def _fetch_relevant_chunks(supabase: Client, pathway_slug: str) -> str:
    """
    Pull up to 10 immigration_chunks rows for the pathway's visa_type.
    Falls back to 'general' chunks if the primary type returns nothing.
    Returns a single concatenated string (max ~4 000 chars).
    """
    visa_type = _slug_to_visa_type(pathway_slug)
    for query_type in (visa_type, "general"):
        try:
            result = (
                supabase.table("immigration_chunks")
                .select("chunk_text")
                .eq("visa_type", query_type)
                .limit(10)
                .execute()
            )
            if result.data:
                return "\n\n".join(row["chunk_text"] for row in result.data)[:4000]
        except Exception as exc:
            logger.warning(
                f"Could not fetch immigration_chunks for visa_type={query_type}: {exc}"
            )
    return ""


def _parse_json(raw: str) -> Optional[dict]:
    """Parse Claude's response as JSON, stripping accidental markdown fences."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        inner = lines[1:-1] if lines and lines[-1].strip() == "```" else lines[1:]
        text = "\n".join(inner)
    try:
        result = json.loads(text)
        return result if isinstance(result, dict) else None
    except json.JSONDecodeError as exc:
        logger.error(f"JSON parse error: {exc} — raw (first 300 chars): {raw[:300]}")
        return None


def _extract_with_claude(
    client: anthropic.Anthropic,
    step: dict,
    pathway_title: str,
    ircc_content: str,
) -> Optional[dict]:
    """Call claude-haiku-4-5-20251001 to extract enrichment fields for a single step."""
    prompt = _EXTRACTION_PROMPT.format(
        title=step["title"],
        description=step["description"],
        pathway_title=pathway_title,
        ircc_content=ircc_content[:10000],
    )
    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text
    except Exception as exc:
        logger.error(f"Claude API error for step '{step['title']}': {exc}")
        return None

    return _parse_json(raw)


def _upsert_step_enrichment(supabase: Client, step_id: str, extracted: dict) -> None:
    """Write all extracted enrichment fields (including nulls) back to pathway_steps."""
    payload: dict = {
        "official_url": extracted.get("official_url"),
        "form_numbers": extracted.get("form_numbers"),
        "fee_cad": extracted.get("fee_cad"),
        "estimated_days_min": extracted.get("estimated_days_min"),
        "estimated_days_max": extracted.get("estimated_days_max"),
        "checklist_items": extracted.get("checklist_items"),
        "pro_tips": extracted.get("pro_tips"),
        "last_enriched_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase.table("pathway_steps").update(payload).eq("id", step_id).execute()


def run() -> dict:
    """
    Run the enricher for all stale Canadian pathway steps.

    Returns a summary dict: {"processed": int, "skipped": int, "failed": int}.
    """
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_key:
        raise EnvironmentError("Missing required environment variable: ANTHROPIC_API_KEY")

    supabase = _create_supabase()
    claude_client = anthropic.Anthropic(api_key=anthropic_key)

    # ── 1. Resolve Canada country id ──────────────────────────────────────────
    countries_result = (
        supabase.table("countries").select("id").eq("iso_code", "CA").execute()
    )
    canada_country_id: Optional[str] = (
        countries_result.data[0]["id"] if countries_result.data else None
    )

    # ── 2. Fetch all Canada pathways ──────────────────────────────────────────
    pathways_result = supabase.table("pathways").select("id, title, slug, country_id").execute()
    canada_pathways: dict[str, dict] = {
        p["id"]: p
        for p in (pathways_result.data or [])
        if p["country_id"] == canada_country_id or p["slug"].startswith("canada-")
    }

    if not canada_pathways:
        logger.warning("No Canadian pathways found — nothing to enrich")
        return {"processed": 0, "skipped": 0, "failed": 0}

    logger.info(f"Found {len(canada_pathways)} Canadian pathways")

    # ── 3. Fetch stale steps for those pathways ────────────────────────────────
    stale_cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    canada_pathway_ids = list(canada_pathways.keys())

    # Supabase-py doesn't support compound OR on nullable timestamps via .or_()
    # easily, so we fetch all steps for these pathways and filter in Python.
    steps_result = (
        supabase.table("pathway_steps")
        .select("id, title, description, pathway_id, last_enriched_at")
        .in_("pathway_id", canada_pathway_ids)
        .execute()
    )
    all_steps = steps_result.data or []

    stale_steps = [
        s for s in all_steps
        if s["last_enriched_at"] is None
        or s["last_enriched_at"] < stale_cutoff
    ]

    skipped = len(all_steps) - len(stale_steps)
    logger.info(
        f"{len(all_steps)} total Canadian steps — "
        f"{len(stale_steps)} to enrich, {skipped} fresh (skipped)"
    )

    if not stale_steps:
        logger.info("All steps are fresh. Nothing to do.")
        return {"processed": 0, "skipped": skipped, "failed": 0}

    # ── 4. Fetch shared IRCC pages once ───────────────────────────────────────
    logger.info("Fetching IRCC processing times page…")
    processing_times_text = _fetch_ircc_page(_PROCESSING_TIMES_URL)
    logger.info("Fetching IRCC fees page…")
    fees_text = _fetch_ircc_page(_FEES_URL)
    shared_ircc = (
        f"=== IRCC PROCESSING TIMES ===\n{processing_times_text}\n\n"
        f"=== IRCC FEES ===\n{fees_text}"
    )

    # ── 5. Enrich each stale step ─────────────────────────────────────────────
    stats = {"processed": 0, "skipped": skipped, "failed": 0}

    for step in stale_steps:
        pathway = canada_pathways.get(step["pathway_id"], {})
        pathway_title = pathway.get("title", "")
        pathway_slug = pathway.get("slug", "")

        logger.info(
            f"Enriching: '{step['title']}' "
            f"(pathway: {pathway_title}, id: {step['id']})"
        )

        chunks_text = _fetch_relevant_chunks(supabase, pathway_slug)
        ircc_content = shared_ircc
        if chunks_text:
            ircc_content += f"\n\n=== RELEVANT PATHWAY CONTENT ===\n{chunks_text}"

        extracted = _extract_with_claude(claude_client, step, pathway_title, ircc_content)

        if extracted is None:
            logger.error(f"  Extraction failed for step {step['id']} — skipping upsert")
            stats["failed"] += 1
            continue

        try:
            _upsert_step_enrichment(supabase, step["id"], extracted)
            logger.info(f"  Enriched: official_url={extracted.get('official_url')!r}")
            stats["processed"] += 1
        except Exception as exc:
            logger.error(f"  Upsert failed for step {step['id']}: {exc}")
            stats["failed"] += 1

    logger.info(
        f"Enrichment run complete — "
        f"processed={stats['processed']} "
        f"skipped={stats['skipped']} "
        f"failed={stats['failed']}"
    )
    return stats


if __name__ == "__main__":
    run()
