"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateCoverDataURI } from "@/lib/cover-art";
import { slugify } from "@/lib/utils/slugify";

/** Admin UI for AI-assisted blog post creation with live streaming preview. */
export default function NewArticlePage() {
  const router = useRouter();

  const [topic, setTopic] = useState("");
  const [tags, setTags] = useState("");
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = slugify(title || topic);
  const coverSrc = slug ? generateCoverDataURI(slug) : null;

  async function generate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setBody("");
    setTitle("");
    setError(null);

    try {
      const res = await fetch("/api/admin/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), tags: tags.split(",").map((t) => t.trim()).filter(Boolean) }),
      });

      if (!res.ok || !res.body) {
        setError("Generation failed. Please try again.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Parse SSE chunks from Anthropic stream
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]" || !raw) continue;
          try {
            const event = JSON.parse(raw) as { type: string; delta?: { type: string; text?: string } };
            if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
              full += event.delta.text;
              setBody(full);
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }

      // Extract title from first # heading
      const headingMatch = full.match(/^#\s+(.+)/m);
      if (headingMatch) setTitle(headingMatch[1].trim());

      // Extract excerpt from first paragraph after heading
      const lines2 = full.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
      if (lines2[0]) setExcerpt(lines2[0].slice(0, 200));
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function save(status: "draft" | "published") {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/publish-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          excerpt: excerpt.trim() || null,
          body: body.trim(),
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          type: "article",
          status,
        }),
      });

      const json = await res.json() as { post?: { slug: string }; error?: { message: string } };
      if (!res.ok || json.error) {
        setError(json.error?.message ?? "Save failed.");
        return;
      }
      router.push("/admin/blog");
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-8">New Article</h1>

      {error && (
        <div className="mb-6 p-4 rounded-card bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-8">
        {/* Left — generator + editor */}
        <div className="flex flex-col gap-5">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">Topic</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. How to improve your CRS score for Express Entry"
              className="w-full px-4 py-2.5 rounded-input border border-border bg-bg-surface text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-500 transition-colors duration-fast"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Express Entry, CRS Score, Canada"
              className="w-full px-4 py-2.5 rounded-input border border-border bg-bg-surface text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-500 transition-colors duration-fast"
            />
          </div>

          <button
            onClick={generate}
            disabled={generating || !topic.trim()}
            className="px-6 py-2.5 rounded-btn bg-accent-500 text-white text-sm font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-fast"
          >
            {generating ? "Writing…" : "Generate with AI"}
          </button>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title"
              className="w-full px-4 py-2.5 rounded-input border border-border bg-bg-surface text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-500 transition-colors duration-fast"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">Excerpt</label>
            <input
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Short summary shown on cards"
              className="w-full px-4 py-2.5 rounded-input border border-border bg-bg-surface text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-500 transition-colors duration-fast"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">Markdown body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              className="w-full px-4 py-3 rounded-input border border-border bg-bg-surface text-text-primary text-sm font-mono placeholder:text-text-tertiary focus:outline-none focus:border-accent-500 transition-colors duration-fast resize-y"
              placeholder="Article markdown will appear here after generation…"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => save("draft")}
              disabled={saving || !title.trim() || !body.trim()}
              className="flex-1 py-2.5 rounded-btn border border-border text-sm text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-fast"
            >
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button
              onClick={() => save("published")}
              disabled={saving || !title.trim() || !body.trim()}
              className="flex-1 py-2.5 rounded-btn bg-text-primary text-white text-sm hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-fast"
            >
              {saving ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>

        {/* Right — preview */}
        <div className="flex flex-col gap-5">
          {coverSrc && (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">Cover art</p>
              <img
                src={coverSrc}
                alt="Generated cover art"
                className="w-full aspect-video rounded-card object-cover"
              />
              {slug && (
                <p className="text-xs text-text-tertiary mt-1">Slug: <code className="font-mono">{slug}</code></p>
              )}
            </div>
          )}
          {body && (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">Preview</p>
              <div className="prose prose-sm max-w-none text-text-secondary p-4 bg-bg-surface rounded-card border border-border overflow-auto max-h-[600px]">
                <pre className="whitespace-pre-wrap text-xs font-mono">{body}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
