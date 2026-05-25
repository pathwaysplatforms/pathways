from supabase import Client
from utils.logger import get_logger

logger = get_logger(__name__)


def upsert_source(
    supabase: Client,
    country: str,
    visa_type: str,
    source_url: str,
    raw_markdown: str,
    content_hash: str,
) -> str:
    """
    Upsert a source record. Returns the source UUID.
    On conflict (source_url), updates the markdown, hash, and scraped_at.
    """
    result = (
        supabase.table("immigration_sources")
        .upsert(
            {
                "country": country,
                "visa_type": visa_type,
                "source_url": source_url,
                "raw_markdown": raw_markdown,
                "content_hash": content_hash,
                "is_active": True,
            },
            on_conflict="source_url",
        )
        .execute()
    )

    source_id: str = result.data[0]["id"]
    logger.info(f"Upserted source {source_id} for {source_url}")
    return source_id


def upsert_chunks(
    supabase: Client,
    source_id: str,
    country: str,
    visa_type: str,
    embedded_chunks: list[dict],
) -> None:
    """
    Bulk insert all chunks for a source.
    Caller is responsible for deleting old chunks first.
    """
    rows = [
        {
            "source_id": source_id,
            "country": country,
            "visa_type": visa_type,
            "chunk_index": chunk["metadata"].get("chunk_index", i),
            "chunk_text": chunk["text"],
            "embedding": chunk["embedding"],
            "token_count": len(chunk["text"]) // 4,  # approximate
        }
        for i, chunk in enumerate(embedded_chunks)
    ]

    # Supabase has a 1000-row upsert limit — batch if needed
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        supabase.table("immigration_chunks").insert(batch).execute()
        logger.info(f"Inserted batch {i // batch_size + 1} ({len(batch)} chunks)")
