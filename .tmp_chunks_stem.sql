SELECT id, source_url, title, LEFT(content, 300) as content_preview FROM immigration_chunks WHERE content ILIKE '%STEM%' AND content ILIKE '%NOC%' ORDER BY id LIMIT 10;
