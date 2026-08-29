import json
import re
from datetime import date, datetime
from typing import Optional

from bs4 import BeautifulSoup, Tag
from utils.logger import get_logger

logger = get_logger(__name__)

# Maps IRCC draw name text to the draw_type values stored in immigration_draws.
# Matching is case-insensitive and uses substring fallback (see _normalize_draw_type).
_DRAW_TYPE_MAP: dict[str, str] = {
    "no program specified": "general",
    "general": "general",
    "canadian experience class": "cec",
    "federal skilled worker": "fsw",
    "federal skilled workers": "fsw",
    "federal skilled trades": "fst",
    "provincial nominee program": "pnp",
    "provincial nominees": "pnp",
    "french language proficiency": "french_language",
    "french-language proficiency": "french_language",
    "french language": "french_language",
    "stem occupations": "stem",
    "healthcare and social services": "healthcare",
    "healthcare occupations": "healthcare",
    "healthcare": "healthcare",
    "physicians": "healthcare",
    "trade occupations": "trades",
    "trades occupations": "trades",
    "agriculture and agri-food occupations": "agriculture",
    "agriculture and agri-food": "agriculture",
    "transport occupations": "transport",
    "transportation occupations": "transport",
    "education occupations": "education",
    "education": "education",
    "senior managers": "senior_managers",
}

# Keywords that identify a text node as a draw type header (not a nav/label)
_DRAW_TYPE_KEYWORDS = [
    "nominee", "provincial", "general", "french", "stem",
    "healthcare", "trade", "transport", "agriculture",
    "skilled worker", "skilled trades", "experience class",
    "no program",
]


def parse(html: str, cfg: dict) -> list[dict]:
    """Parse Canada Express Entry draws from raw HTML.

    Both IRCC pages now load draw data dynamically from a JSON endpoint via
    data-wb-json attributes — the HTML contains no actual round data. This
    function detects the JSON endpoint URL embedded in the page and fetches it
    directly. HTML table and bullet-list parsers are retained as a fallback for
    any future page-format change.
    """
    soup = BeautifulSoup(html, "html.parser")

    draws = _parse_json_endpoint(html, cfg)
    if draws:
        return draws

    draws = _parse_table(soup, cfg)
    if draws:
        logger.info(f"Canada draws: {len(draws)} draws via table")
        return draws

    draws = _parse_bullet_list(soup, cfg)
    logger.info(f"Canada draws: {len(draws)} draws via bullet list")
    return draws


# ─── Direct rounds-JSON parser (primary path) ────────────────────────────────

def parse_rounds_json(json_text: str, cfg: dict) -> list[dict]:
    """Parse the IRCC EE rounds JSON document (fetched directly by the scraper)
    into draw records. This is the primary path — no HTML involved.
    """
    try:
        data = json.loads(json_text)
    except json.JSONDecodeError as exc:
        logger.error(f"Rounds JSON parse error: {exc}")
        return []

    rounds = data.get("rounds", [])
    draws = _rounds_to_draws(rounds, cfg)
    logger.info(
        f"Canada draws: {len(draws)} draws parsed from {len(rounds)} rounds in JSON document"
    )
    return draws


# ─── JSON endpoint discovery via HTML (fallback path) ────────────────────────

def _parse_json_endpoint(html: str, cfg: dict) -> list[dict]:
    """Extract the IRCC WET JSON endpoint URL from a data-wb-json attribute,
    fetch it with curl_cffi, and parse all rounds into draw records.

    Both the latest-rounds and historical-instructions pages use the same
    endpoint: /content/dam/ircc/documents/json/ee_rounds_123_en.json
    """
    soup = BeautifulSoup(html, "html.parser")

    json_url: Optional[str] = None

    # data-wb-jsonmanager (used on the latest-rounds page)
    for tag in soup.find_all(attrs={"data-wb-jsonmanager": True}):
        raw = tag.get("data-wb-jsonmanager", "")
        m = re.search(r'"url"\s*:\s*"(/[^"#]+\.json)', raw)
        if m:
            json_url = "https://www.canada.ca" + m.group(1)
            break

    # data-wb-json fallback (used on the history page table)
    if not json_url:
        for tag in soup.find_all(attrs={"data-wb-json": True}):
            raw = tag.get("data-wb-json", "")
            m = re.search(r'"url"\s*:\s*"(/[^"#]+\.json)', raw)
            if m:
                json_url = "https://www.canada.ca" + m.group(1)
                break

    if not json_url:
        logger.debug("_parse_json_endpoint: no data-wb-json endpoint found in HTML")
        return []

    logger.info(f"Fetching IRCC rounds JSON endpoint: {json_url}")

    from curl_cffi.requests import get as cffi_get
    try:
        resp = cffi_get(json_url, impersonate="chrome136", timeout=30)
    except Exception as exc:
        logger.error(f"Failed to fetch {json_url}: {exc}")
        return []

    if resp.status_code != 200:
        logger.error(f"HTTP {resp.status_code} for {json_url}")
        return []

    try:
        data = resp.json()
    except Exception as exc:
        logger.error(f"JSON parse error for {json_url}: {exc}")
        return []

    rounds = data.get("rounds", [])
    logger.info(f"Canada draws: {len(rounds)} rounds found in JSON endpoint — parsing")

    draws = _rounds_to_draws(rounds, cfg)
    logger.info(f"Canada draws: {len(draws)} draws parsed from JSON endpoint")
    return draws


def _rounds_to_draws(rounds: list[dict], cfg: dict) -> list[dict]:
    """Convert IRCC rounds-JSON objects into immigration_draws records."""
    draws: list[dict] = []
    for r in rounds:
        draw_number = _parse_int(r.get("drawNumber", ""))
        draw_date_str = r.get("drawDate", "")   # already YYYY-MM-DD
        draw_name = r.get("drawName", "")
        draw_size = _parse_int(r.get("drawSize", ""))
        draw_crs = _parse_int(r.get("drawCRS", ""))
        draw_cutoff = r.get("drawCutOff", "")

        if not draw_date_str:
            continue

        try:
            draw_date = date.fromisoformat(draw_date_str)
        except ValueError:
            logger.warning(f"Could not parse date '{draw_date_str}' for round {draw_number}")
            continue

        if draw_crs is None or draw_size is None:
            logger.warning(f"Missing CRS/invitations for round {draw_number}")
            continue

        norm_type, is_unknown = _normalize_draw_type(draw_name)
        tie_breaking = _parse_tie_datetime(draw_cutoff)

        draws.append({
            "country": cfg["country"],
            "program": cfg["program"],
            "draw_date": draw_date.isoformat(),
            "round_number": draw_number,
            "draw_type": norm_type,
            "invitations_issued": draw_size,
            "cutoff_score": draw_crs,
            "tie_breaking_date": tie_breaking,
            "source_url": cfg["url"],
            "raw_data": {
                "raw_type": draw_name,
                "_unknown_type": is_unknown,
            },
        })

    return draws


# ─── Table parser (historical ministerial instructions page) ─────────────────

def _parse_table(soup: BeautifulSoup, cfg: dict) -> list[dict]:
    """Parse the full-history table on the ministerial instructions page.

    Expected columns: Round | Type of round | Date | CRS score | Invitations | Tie-breaking
    """
    table = soup.find("table")
    if not isinstance(table, Tag):
        return []

    rows = table.find_all("tr")
    logger.debug(f"_parse_table: found {len(rows)} <tr> rows in HTML table")
    draws: list[dict] = []

    for row in rows[1:]:  # row 0 is the header
        cells = row.find_all(["td", "th"])
        if len(cells) < 5:
            continue

        texts = [c.get_text(separator=" ", strip=True) for c in cells]

        round_num = _parse_int(texts[0])
        if round_num is None:
            continue  # skip additional header rows mid-table

        draw_type_raw = texts[1]
        date_str = texts[2]
        crs_str = texts[3]
        inv_str = texts[4]
        tie_str = texts[5] if len(texts) > 5 else ""

        draw_date = _parse_date(date_str)
        if not draw_date:
            logger.warning(f"Could not parse date '{date_str}' for round {round_num}")
            continue

        cutoff = _parse_int(crs_str)
        invitations = _parse_int(inv_str)
        if cutoff is None or invitations is None:
            logger.warning(f"Missing CRS/invitations for round {round_num}")
            continue

        norm_type, is_unknown = _normalize_draw_type(draw_type_raw)
        tie_breaking = _parse_tie_datetime(tie_str)

        draws.append({
            "country": cfg["country"],
            "program": cfg["program"],
            "draw_date": draw_date.isoformat(),
            "round_number": round_num,
            "draw_type": norm_type,
            "invitations_issued": invitations,
            "cutoff_score": cutoff,
            "tie_breaking_date": tie_breaking,
            "source_url": cfg["url"],
            "raw_data": {
                "raw_type": draw_type_raw,
                "_unknown_type": is_unknown,
            },
        })

    return draws


# ─── Bullet-list parser (latest rounds page) ────────────────────────────────

def _parse_bullet_list(soup: BeautifulSoup, cfg: dict) -> list[dict]:
    """Parse bullet-list draw sections from the latest rounds page.

    Each section has a header with draw type (and optionally round number)
    followed by a <ul> with Date, CRS, Invitations, Tie-breaking items.
    """
    main = soup.find("main") or soup.find("div", id="wb-cont") or soup.body
    if not isinstance(main, Tag):
        return []

    candidate_elems = main.find_all(["h2", "h3", "h4", "p", "ul"])
    logger.debug(f"_parse_bullet_list: found {len(candidate_elems)} candidate elements in HTML")

    draws: list[dict] = []
    pending: dict = {}

    def _flush(current: dict) -> None:
        draw = _build_draw(current, cfg)
        if draw:
            draws.append(draw)

    for elem in candidate_elems:
        if not isinstance(elem, Tag):
            continue

        if elem.name in ("h2", "h3", "h4"):
            text = elem.get_text(strip=True)

            round_match = re.search(r'[Rr]ound\s*#?\s*(\d+)|[Dd]raw\s*#?\s*(\d+)', text)
            is_type = _is_draw_type_text(text)

            if round_match or is_type:
                if pending:
                    _flush(pending)
                    pending = {}

                if round_match:
                    rn = round_match.group(1) or round_match.group(2)
                    pending["round_number"] = int(rn)
                    # Type might follow in the same header after stripping round part
                    remainder = re.sub(r'[Rr]ound\s*#?\s*\d+|[Dd]raw\s*#?\s*\d+', '', text).strip(" -–:")
                    if remainder and _is_draw_type_text(remainder):
                        norm, is_unk = _normalize_draw_type(remainder)
                        pending["draw_type"] = norm
                        pending["raw_type"] = remainder
                        pending["_unknown_type"] = is_unk

                if is_type and "draw_type" not in pending:
                    norm, is_unk = _normalize_draw_type(text)
                    pending["draw_type"] = norm
                    pending["raw_type"] = text
                    pending["_unknown_type"] = is_unk

            continue

        if elem.name == "p":
            text = elem.get_text(strip=True)
            # Some pages wrap draw type in a <p><strong>...</strong></p>
            strong = elem.find("strong")
            if strong and isinstance(strong, Tag):
                strong_text = strong.get_text(strip=True)
                if _is_draw_type_text(strong_text):
                    if pending:
                        _flush(pending)
                        pending = {}
                    norm, is_unk = _normalize_draw_type(strong_text)
                    pending["draw_type"] = norm
                    pending["raw_type"] = strong_text
                    pending["_unknown_type"] = is_unk
            continue

        if elem.name == "ul" and pending:
            for li in elem.find_all("li"):
                if not isinstance(li, Tag):
                    continue
                li_text = li.get_text(separator=" ", strip=True)

                date_m = re.search(
                    r'Date and time[^:]*:\s*([A-Z][a-z]+ \d{1,2},\s*\d{4})', li_text
                )
                if date_m:
                    d = _parse_date(date_m.group(1))
                    if d:
                        pending["draw_date"] = d

                crs_m = re.search(r'CRS score[^:]*:\s*([\d,]+)', li_text)
                if crs_m:
                    pending["cutoff_score"] = int(crs_m.group(1).replace(",", ""))

                inv_m = re.search(r'Number of invitations[^:]*:\s*([\d,]+)', li_text)
                if inv_m:
                    pending["invitations_issued"] = int(inv_m.group(1).replace(",", ""))

                tie_m = re.search(
                    r'Tie-breaking rule[^:]*:\s*([A-Z][a-z]+ \d{1,2},\s*\d{4}'
                    r'\s+at\s+\d{2}:\d{2}:\d{2}\s+UTC)',
                    li_text,
                )
                if tie_m:
                    pending["tie_breaking_date"] = _parse_tie_datetime(tie_m.group(1))

    if pending:
        _flush(pending)

    return draws


def _build_draw(current: dict, cfg: dict) -> Optional[dict]:
    """Validate and assemble a draw record from accumulated bullet-list state."""
    required = ("draw_type", "draw_date", "cutoff_score", "invitations_issued")
    if not all(k in current for k in required):
        return None

    return {
        "country": cfg["country"],
        "program": cfg["program"],
        "draw_date": current["draw_date"].isoformat(),
        "round_number": current.get("round_number"),
        "draw_type": current["draw_type"],
        "invitations_issued": current["invitations_issued"],
        "cutoff_score": current["cutoff_score"],
        "tie_breaking_date": current.get("tie_breaking_date"),
        "source_url": cfg["url"],
        "raw_data": {
            "raw_type": current.get("raw_type", ""),
            "_unknown_type": current.get("_unknown_type", False),
        },
    }


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _is_draw_type_text(text: str) -> bool:
    """Return True if text looks like a draw category name."""
    if ":" in text or len(text) < 3 or len(text) > 100:
        return False
    tl = text.lower()
    return any(kw in tl for kw in _DRAW_TYPE_KEYWORDS)


def _normalize_draw_type(raw: str) -> tuple[str, bool]:
    """Return (normalized_value, is_unknown).  is_unknown=True means the raw
    type didn't match any known label and should be flagged in the run summary.
    """
    key = raw.lower().strip()

    if key in _DRAW_TYPE_MAP:
        return _DRAW_TYPE_MAP[key], False

    # Partial / substring match
    for pattern, mapped in _DRAW_TYPE_MAP.items():
        if pattern in key:
            return mapped, False

    return key.replace(" ", "_"), True


def _parse_int(text: str) -> Optional[int]:
    """Extract the first integer from text, ignoring commas."""
    cleaned = re.sub(r"[,\s]", "", text)
    m = re.search(r"\d+", cleaned)
    return int(m.group()) if m else None


def _parse_date(text: str) -> Optional[date]:
    """Parse 'Month DD, YYYY' (possibly with a trailing time component)."""
    m = re.match(r"([A-Z][a-z]+ \d{1,2},\s*\d{4})", text.strip())
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1).strip(), "%B %d, %Y").date()
    except ValueError:
        return None


def _parse_tie_datetime(text: str) -> Optional[str]:
    """Parse 'Month DD, YYYY at HH:MM:SS UTC' into an ISO-8601 string."""
    if not text:
        return None
    m = re.search(
        r"([A-Z][a-z]+ \d{1,2},\s*\d{4})\s+at\s+(\d{2}:\d{2}:\d{2})\s+UTC",
        text,
    )
    if not m:
        return None
    try:
        dt = datetime.strptime(f"{m.group(1).strip()} {m.group(2)}", "%B %d, %Y %H:%M:%S")
        return dt.isoformat() + "Z"
    except ValueError:
        return None
