"""
Immigration pathway extraction pipeline.

Reads immigration_chunks grouped by visa_type, calls Claude to extract structured
eligibility metadata, and upserts results into the pathways table.
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pydantic import BaseModel, ValidationError, field_validator

sys.path.insert(0, str(Path(__file__).parent))

from utils.logger import get_logger

load_dotenv()
logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Country-specific visa_type → pathway config mappings
# Add a new dict here when a new country is added; extraction logic is generic.
# ---------------------------------------------------------------------------

CANADA_VISA_TYPE_MAP: dict[str, dict] = {
    "express_entry_fsw": {
        "slug": "canada-express-entry-fsw",
        "title": "Express Entry – Federal Skilled Worker",
        "category_slug": "skilled-worker",
        "pathway_type": "permanent_residency",
    },
    "express_entry_cec": {
        "slug": "canada-cec",
        "title": "Canadian Experience Class (CEC)",
        "category_slug": "skilled-worker",
        "pathway_type": "permanent_residency",
    },
    "express_entry_fst": {
        "slug": "canada-fstp",
        "title": "Federal Skilled Trades Program (FSTP)",
        "category_slug": "skilled-worker",
        "pathway_type": "permanent_residency",
    },
    "pnp_ontario": {
        "slug": "canada-pnp-ontario",
        "title": "Ontario Immigrant Nominee Program (OINP)",
        "category_slug": "skilled-worker",
        "pathway_type": "permanent_residency",
    },
    "pnp_bc": {
        "slug": "canada-pnp-bc",
        "title": "BC Provincial Nominee Program (BC PNP)",
        "category_slug": "skilled-worker",
        "pathway_type": "permanent_residency",
    },
    "pnp_alberta": {
        "slug": "canada-pnp-alberta",
        "title": "Alberta Advantage Immigration Program (AAIP)",
        "category_slug": "skilled-worker",
        "pathway_type": "permanent_residency",
    },
    "family_sponsorship": {
        "slug": "canada-family-sponsorship",
        "title": "Family Sponsorship",
        "category_slug": "family-reunification",
        "pathway_type": "permanent_residency",
    },
    "pgwp": {
        "slug": "canada-pgwp",
        "title": "Post-Graduation Work Permit (PGWP)",
        "category_slug": "skilled-worker",
        "pathway_type": "work_permit",
    },
    "atlantic_immigration": {
        "slug": "canada-atlantic-immigration",
        "title": "Atlantic Immigration Program (AIP)",
        "category_slug": "skilled-worker",
        "pathway_type": "permanent_residency",
    },
    "startup_visa": {
        "slug": "canada-startup-visa",
        "title": "Start-up Visa Program",
        "category_slug": "investor",
        "pathway_type": "permanent_residency",
    },
    "rural_northern_immigration": {
        "slug": "canada-rnip",
        "title": "Rural and Northern Immigration Pilot (RNIP)",
        "category_slug": "skilled-worker",
        "pathway_type": "permanent_residency",
    },
    "caregiver": {
        "slug": "canada-caregiver",
        "title": "Home Child Care Provider & Home Support Worker Pilots",
        "category_slug": "skilled-worker",
        "pathway_type": "permanent_residency",
    },
    "bowp": {
        "slug": "canada-bowp",
        "title": "Bridging Open Work Permit (BOWP)",
        "category_slug": "skilled-worker",
        "pathway_type": "work_permit",
    },
    "express_entry_stem": {
        "slug": "canada-express-entry-stem",
        "title": "Express Entry – STEM Category Draw",
        "category_slug": "skilled-worker",
        "pathway_type": "permanent_residency",
    },
}

# Maps the `country` parameter (matches immigration_chunks.country) to its
# visa_type mapping dict and ISO 3166-1 alpha-2 code.
COUNTRY_CONFIG: dict[str, dict] = {
    "canada": {
        "iso_code": "CA",
        "visa_type_map": CANADA_VISA_TYPE_MAP,
    },
}

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ExtractedStep(BaseModel):
    """A single procedural step extracted from immigration documentation."""

    step_number: int
    title: str
    description: str
    estimated_duration: str = "Unknown"
    is_optional: bool = False


class ExtractedDocument(BaseModel):
    """A document requirement extracted from immigration documentation."""

    name: str
    description: str = ""
    is_mandatory: bool = True
    document_type: str = "other"


class PathwayExtractionResult(BaseModel):
    """Structured eligibility metadata extracted by Claude."""

    requires_degree: bool | None = None
    min_years_experience: int
    english_min_score: Optional[str]
    processing_time_min: Optional[str]
    processing_time_max: Optional[str]
    additional_rules: dict
    steps: list[ExtractedStep] = []
    document_requirements: list[ExtractedDocument] = []

    @field_validator("requires_degree", mode="before")
    @classmethod
    def default_requires_degree(cls, v: object) -> bool:
        """Coerce explicit null from Claude to False."""
        return False if v is None else v


# ---------------------------------------------------------------------------
# JSON repair helper
# ---------------------------------------------------------------------------


def repair_json(raw: str) -> str:
    """Attempt to recover a truncated JSON response by finding the last valid closing brace."""
    raw = raw.strip()
    try:
        json.loads(raw)
        return raw
    except json.JSONDecodeError:
        pass
    depth = 0
    last_close = -1
    in_string = False
    escape_next = False
    for i, ch in enumerate(raw):
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"' and not escape_next:
            in_string = not in_string
        if not in_string:
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    last_close = i
    if last_close > 0:
        truncated = raw[: last_close + 1]
        try:
            json.loads(truncated)
            return truncated
        except json.JSONDecodeError:
            pass
    return raw


# ---------------------------------------------------------------------------
# Extraction function (pure — takes chunks + config, returns model)
# ---------------------------------------------------------------------------


def extract_pathway_metadata(
    visa_type: str,
    chunks: list[str],
    pathway_config: dict,
    anthropic_client,
) -> PathwayExtractionResult:
    """
    Call Claude to extract structured pathway metadata from raw documentation chunks.

    Raises ValueError on JSON parse failure or Pydantic validation failure so the
    caller can log and skip without crashing the full run.
    """
    combined_text = "\n\n---\n\n".join(chunks[:20])

    prompt = f"""You are an immigration data extraction specialist.
Extract structured eligibility requirements from the following official
Canadian immigration documentation for the pathway: {pathway_config['title']}

Return ONLY a valid JSON object matching this exact schema:
{{
  "requires_degree": boolean,
  "min_years_experience": integer (0 if none required),
  "english_min_score": string or null (e.g. "CLB 7 all bands"),
  "processing_time_min": string or null (e.g. "6 months"),
  "processing_time_max": string or null (e.g. "12 months"),
  "additional_rules": {{
    "clb_min": {{"listening": int, "reading": int, "writing": int, "speaking": int}} or null,
    "noc_teer_eligible": [list of eligible TEER levels as integers] or null,
    "eca_required": boolean,
    "age_max": integer or null,
    "canadian_work_required": boolean,
    "canadian_work_min_years": integer,
    "job_offer_required": boolean,
    "provincial_nomination_eligible": boolean,
    "points_based": boolean,
    "key_benefits": [list of 3-5 short strings],
    "key_limitations": [list of 2-4 short strings],
    "recent_changes": [{{"date": "YYYY-MM", "description": "..."}}],
    "source_urls": [list of official canada.ca URLs mentioned]
  }},
  "steps": [
    {{
      "step_number": integer (1-based, sequential),
      "title": string (concise action, max 60 chars),
      "description": string (1-3 sentences in plain English),
      "estimated_duration": string (e.g. "2-4 weeks") or "Unknown" if not stated,
      "is_optional": boolean
    }}
  ],
  "document_requirements": [
    {{
      "name": string (concise document name, max 80 chars),
      "description": string (1 sentence explaining what it is),
      "is_mandatory": boolean,
      "document_type": string (snake_case, e.g. "passport", "language_test", "employment_letter")
    }}
  ]
}}

Rules:
- Extract ONLY what is explicitly stated in the text
- If a requirement is not mentioned, use null for optional fields
  and false for booleans (do not assume)
- For CLB minimums: extract the exact band scores stated
- For NOC TEER: list only the TEER levels explicitly mentioned as eligible
- No preamble, no explanation, no markdown — raw JSON only

STEPS rules:
- Extract 4 to 8 sequential steps a person must complete to apply
- Each step is a distinct action (e.g. "Determine eligibility", "Gather documents",
  "Submit Expression of Interest", "Receive Invitation to Apply")
- Use plain English, not government jargon
- estimated_duration: Realistic time estimate for this step. Use specific ranges like '1-3 days',
  '1–2 weeks', '4–8 weeks', '2–3 months'. Adapt the range based on standard IRCC processing norms if
    the source text does not mention a duration, infer a realistic estimate — do NOT return
  'Unknown' or null. Every step must have a non-empty estimated_duration string.
- Mark is_optional: true only for steps that are explicitly conditional
- Return empty array if the text lacks procedural detail

DOCUMENT_REQUIREMENTS rules:
- Include only documents explicitly mentioned in the source text
- is_mandatory: true unless the text says "if applicable", "optional", or "may be required"
- document_type: snake_case string matching the document kind (e.g. "passport",
  "language_test", "police_certificate", "employment_letter", "bank_statement",
  "birth_certificate", "marriage_certificate", "medical_exam", "photo")
- Return empty array if the text does not mention specific documents

DOCUMENTATION:
{combined_text}
"""

    response = anthropic_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw: str = response.content[0].text.strip()

    # Strip markdown code fences if Claude wrapped the JSON
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    raw = repair_json(raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"JSON parse failed for {visa_type}: {exc}. "
            f"Raw response (first 300 chars): {raw[:300]}"
        ) from exc

    try:
        return PathwayExtractionResult(**data)
    except ValidationError as exc:
        raise ValueError(
            f"Pydantic validation failed for {visa_type}: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def run_extraction(
    country: str = "canada",
    visa_types: Optional[list[str]] = None,
    force: bool = False,
    dry_run: bool = False,
) -> dict:
    """
    Run the extraction pipeline for a country.

    Reads immigration_chunks grouped by visa_type, calls Claude for each, and
    upserts structured metadata into the pathways table.

    Args:
        country: Matches immigration_chunks.country (e.g. 'canada').
        visa_types: Restrict to these visa_types. None means process all.
        force: Re-extract even if pathway was updated within the last 7 days.
        dry_run: Print what would be extracted without calling Claude or writing to DB.

    Returns:
        Summary dict with keys: processed, skipped, failed, errors.
    """
    if country not in COUNTRY_CONFIG:
        raise ValueError(
            f"Unknown country '{country}'. Add it to COUNTRY_CONFIG in extractor.py."
        )

    country_cfg = COUNTRY_CONFIG[country]
    visa_type_map: dict[str, dict] = country_cfg["visa_type_map"]
    iso_code: str = country_cfg["iso_code"]

    target_visa_types = visa_types if visa_types is not None else list(visa_type_map.keys())

    summary: dict = {"processed": 0, "skipped": 0, "failed": 0, "errors": []}

    if dry_run:
        _run_dry(country, target_visa_types, visa_type_map, summary)
        return summary

    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SECRET_KEY")
    anthropic_api_key = os.environ.get("ANTHROPIC_API_KEY")

    missing = [
        name
        for name, val in [
            ("NEXT_PUBLIC_SUPABASE_URL", supabase_url),
            ("SUPABASE_SECRET_KEY", supabase_key),
            ("ANTHROPIC_API_KEY", anthropic_api_key),
        ]
        if not val
    ]
    if missing:
        raise EnvironmentError(f"Missing required environment variables: {', '.join(missing)}")

    from supabase import create_client
    import anthropic as _anthropic

    sb = create_client(supabase_url, supabase_key)  # type: ignore[arg-type]
    ac = _anthropic.Anthropic(api_key=anthropic_api_key)

    country_row = (
        sb.table("countries")
        .select("id")
        .eq("iso_code", iso_code)
        .single()
        .execute()
    )
    if not country_row.data:
        raise RuntimeError(f"Country with iso_code '{iso_code}' not found in database.")
    country_id: str = country_row.data["id"]

    # Cache category_id lookups to avoid repeated queries
    category_id_cache: dict[str, str] = {}

    freshness_cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    for visa_type in target_visa_types:
        if visa_type not in visa_type_map:
            logger.warning(f"visa_type '{visa_type}' not in mapping for country '{country}' — skipping")
            summary["skipped"] += 1
            continue

        pathway_cfg = visa_type_map[visa_type]
        slug: str = pathway_cfg["slug"]

        if not force:
            existing = (
                sb.table("pathways")
                .select("id, updated_at")
                .eq("slug", slug)
                .execute()
            )
            if existing.data:
                updated_str: str = existing.data[0]["updated_at"]
                # Supabase returns ISO 8601 with timezone
                updated_at = datetime.fromisoformat(updated_str.replace("Z", "+00:00"))
                if updated_at > freshness_cutoff:
                    logger.info(
                        f"Skipping '{slug}' — updated {updated_at.date()}, within 7-day window"
                    )
                    summary["skipped"] += 1
                    continue

        chunk_rows = (
            sb.table("immigration_chunks")
            .select("chunk_text, chunk_index")
            .eq("country", country)
            .eq("visa_type", visa_type)
            .order("chunk_index")
            .execute()
        )

        if not chunk_rows.data:
            logger.warning(f"No chunks found for country='{country}' visa_type='{visa_type}' — skipping")
            summary["skipped"] += 1
            continue

        chunks = [row["chunk_text"] for row in chunk_rows.data]
        logger.info(f"Extracting '{slug}' from {len(chunks)} chunks...")

        t_start = time.monotonic()

        try:
            result = extract_pathway_metadata(
                visa_type=visa_type,
                chunks=chunks,
                pathway_config=pathway_cfg,
                anthropic_client=ac,
            )
        except ValueError as exc:
            logger.error(str(exc))
            summary["failed"] += 1
            summary["errors"].append({"visa_type": visa_type, "error": str(exc)})
            continue

        duration_ms = int((time.monotonic() - t_start) * 1000)

        category_slug: str = pathway_cfg["category_slug"]
        if category_slug not in category_id_cache:
            cat_row = (
                sb.table("pathway_categories")
                .select("id")
                .eq("slug", category_slug)
                .single()
                .execute()
            )
            if not cat_row.data:
                logger.error(f"Category '{category_slug}' not found — skipping '{slug}'")
                summary["failed"] += 1
                summary["errors"].append(
                    {"visa_type": visa_type, "error": f"Category '{category_slug}' not found"}
                )
                continue
            category_id_cache[category_slug] = cat_row.data["id"]
        category_id: str = category_id_cache[category_slug]

        additional_rules = {
            **result.additional_rules,
            "pathway_type": pathway_cfg["pathway_type"],
        }

        title: str = pathway_cfg["title"]
        description = (
            f"Official Canadian immigration pathway: {title}. "
            "Administered by Immigration, Refugees and Citizenship Canada (IRCC)."
        )

        payload = {
            "country_id": country_id,
            "category_id": category_id,
            "title": title,
            "slug": slug,
            "official_name": title,
            "description": description,
            "processing_time_min": result.processing_time_min or "TBD",
            "processing_time_max": result.processing_time_max or "TBD",
            "fee_gbp": 0,
            "requires_degree": result.requires_degree,
            "min_years_experience": result.min_years_experience,
            "min_salary_gbp": 0,
            "requires_english_test": result.english_min_score is not None,
            "english_min_score": result.english_min_score,
            "additional_rules": additional_rules,
            "is_active": True,
        }

        try:
            sb.table("pathways").upsert(payload, on_conflict="slug").execute()
        except Exception as exc:
            logger.error(f"Supabase upsert failed for '{slug}': {type(exc).__name__}: {exc}")
            summary["failed"] += 1
            summary["errors"].append({"visa_type": visa_type, "error": str(exc)})
            continue

        pathway_row = (
            sb.table("pathways")
            .select("id")
            .eq("slug", slug)
            .single()
            .execute()
        )
        pathway_id: str = pathway_row.data["id"]

        # Upsert pathway_steps. There is no unique constraint on
        # (pathway_id, step_number), so this is a delete+insert — but enrichment
        # fields written by the enricher must survive the regeneration, otherwise
        # every extraction wipes last_enriched_at and the enricher re-pays a
        # Claude call for every step. Carry them over matched by step_number.
        if result.steps:
            _ENRICHMENT_COLS = (
                "official_url",
                "form_numbers",
                "fee_cad",
                "estimated_days_min",
                "estimated_days_max",
                "checklist_items",
                "pro_tips",
                "last_enriched_at",
            )
            existing_steps = (
                sb.table("pathway_steps")
                .select("step_number, " + ", ".join(_ENRICHMENT_COLS))
                .eq("pathway_id", pathway_id)
                .execute()
            )
            enrichment_by_number: dict[int, dict] = {
                row["step_number"]: row for row in (existing_steps.data or [])
            }

            sb.table("pathway_steps").delete().eq("pathway_id", pathway_id).execute()
            steps_rows = []
            for step in result.steps:
                row = {
                    "pathway_id": pathway_id,
                    "step_number": step.step_number,
                    "title": step.title,
                    "description": step.description,
                    "estimated_duration": step.estimated_duration or "Unknown",
                    "is_optional": step.is_optional,
                }
                prev = enrichment_by_number.get(step.step_number)
                if prev:
                    row.update({col: prev[col] for col in _ENRICHMENT_COLS})
                steps_rows.append(row)
            sb.table("pathway_steps").insert(steps_rows).execute()
            logger.info(f"  ✓ Inserted {len(steps_rows)} steps for {slug}")
        else:
            logger.warning(f"  ⚠ No steps extracted for {slug}")

        # Upsert document_requirements
        if result.document_requirements:
            sb.table("document_requirements").delete().eq("pathway_id", pathway_id).execute()
            doc_rows = [
                {
                    "pathway_id": pathway_id,
                    "name": doc.name,
                    "description": doc.description or "",
                    "is_mandatory": doc.is_mandatory,
                    "document_type": doc.document_type or "other",
                }
                for doc in result.document_requirements
            ]
            sb.table("document_requirements").insert(doc_rows).execute()
            logger.info(f"  ✓ Inserted {len(doc_rows)} documents for {slug}")
        else:
            logger.warning(f"  ⚠ No documents extracted for {slug}")

        clb_min = additional_rules.get("clb_min")
        logger.info(
            f"Extracted '{slug}': requires_degree={result.requires_degree}, "
            f"min_years_experience={result.min_years_experience}, "
            f"clb_min={clb_min}, duration_ms={duration_ms}"
        )
        summary["processed"] += 1

    return summary


def _run_dry(
    country: str,
    target_visa_types: list[str],
    visa_type_map: dict[str, dict],
    summary: dict,
) -> None:
    """Print what would be extracted without calling the API or writing to the DB."""
    print(f"\n{'=' * 60}")
    print(f"Extraction DRY RUN — country: {country}")
    print(f"{'=' * 60}")
    for visa_type in target_visa_types:
        if visa_type not in visa_type_map:
            print(f"  [SKIP] {visa_type} — not in mapping")
            summary["skipped"] += 1
            continue
        cfg = visa_type_map[visa_type]
        print(
            f"  [WOULD EXTRACT] {cfg['slug']}\n"
            f"    title:        {cfg['title']}\n"
            f"    category:     {cfg['category_slug']}\n"
            f"    pathway_type: {cfg['pathway_type']}"
        )
        summary["processed"] += 1
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Extract pathway metadata from immigration_chunks into pathways, pathway_steps, and document_requirements tables."
    )
    parser.add_argument(
        "--pathway",
        type=str,
        default=None,
        metavar="SLUG",
        help="Run extraction for a single pathway slug only (e.g. canada-express-entry-fsw).",
    )
    parser.add_argument(
        "--country",
        type=str,
        default="canada",
        help="Country to extract pathways for (default: canada).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-extract even if pathway was updated within the last 7 days.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be extracted without calling Claude or writing to DB.",
    )
    args = parser.parse_args()

    visa_types: Optional[list[str]] = None
    if args.pathway:
        country_cfg = COUNTRY_CONFIG.get(args.country, {})
        visa_type_map: dict[str, dict] = country_cfg.get("visa_type_map", {})
        matched = [vt for vt, cfg in visa_type_map.items() if cfg["slug"] == args.pathway]
        if not matched:
            logger.error(f"No visa_type mapping found for slug '{args.pathway}' in country '{args.country}'")
            sys.exit(1)
        visa_types = matched

    try:
        summary = run_extraction(
            country=args.country,
            visa_types=visa_types,
            force=args.force,
            dry_run=args.dry_run,
        )
    except (EnvironmentError, RuntimeError, ValueError) as exc:
        logger.error(f"Extraction aborted: {exc}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("Extraction Summary")
    print("=" * 60)
    print(f"  Processed : {summary['processed']}")
    print(f"  Skipped   : {summary['skipped']}")
    print(f"  Failed    : {summary['failed']}")
    if summary["errors"]:
        print("\n  Errors:")
        for err in summary["errors"]:
            print(f"    [{err['visa_type']}] {err['error'][:120]}")
    print("=" * 60 + "\n")

    if summary["failed"] > 0:
        sys.exit(1)
