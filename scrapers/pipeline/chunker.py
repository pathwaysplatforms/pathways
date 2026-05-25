from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter


def chunk_markdown(
    text: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
    metadata: dict | None = None,
) -> list[dict]:
    """
    Two-stage markdown chunking:
    1. Split by Markdown headers to preserve document structure.
    2. Split oversized sections by character count.

    Returns list of dicts with keys: text, metadata, chunk_index.
    """
    metadata = metadata or {}

    header_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=[
            ("#", "h1"),
            ("##", "h2"),
            ("###", "h3"),
        ]
    )

    # ~4 chars per token is a reasonable approximation
    char_size = chunk_size * 4
    char_overlap = chunk_overlap * 4

    token_splitter = RecursiveCharacterTextSplitter(
        chunk_size=char_size,
        chunk_overlap=char_overlap,
        separators=["\n\n", "\n", ". ", " "],
    )

    header_chunks = header_splitter.split_text(text)
    final_chunks: list[dict] = []

    for doc in header_chunks:
        sub_chunks = token_splitter.split_text(doc.page_content)
        for sub in sub_chunks:
            if not sub.strip():
                continue
            final_chunks.append({
                "text": sub.strip(),
                "metadata": {
                    **metadata,
                    **doc.metadata,  # h1, h2, h3 from header splitter
                    "chunk_index": len(final_chunks),
                },
            })

    return final_chunks
