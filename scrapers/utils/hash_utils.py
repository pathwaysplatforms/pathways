import hashlib


def compute_hash(content: str) -> str:
    """SHA256 hash of text content. Used for change detection."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()
