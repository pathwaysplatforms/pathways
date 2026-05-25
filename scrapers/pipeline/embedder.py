import os
from openai import OpenAI
from utils.logger import get_logger

logger = get_logger(__name__)

_client: OpenAI | None = None

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise EnvironmentError("OPENAI_API_KEY is not set")
        _client = OpenAI(api_key=api_key)
    return _client


def embed_chunks(chunks: list[dict]) -> list[dict]:
    """
    Embed a list of chunk dicts in a single batched API call.
    Adds an 'embedding' key (list[float]) to each chunk dict.
    """
    if not chunks:
        return chunks

    client = _get_client()
    texts = [c["text"] for c in chunks]

    logger.info(f"Embedding {len(texts)} chunks via {EMBEDDING_MODEL}")

    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
    )

    for i, chunk in enumerate(chunks):
        chunk["embedding"] = response.data[i].embedding

    logger.info(f"Embedding complete — {len(chunks)} vectors returned")
    return chunks
