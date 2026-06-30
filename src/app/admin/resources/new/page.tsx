"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateCoverDataURI } from "@/lib/cover-art";
import { slugify } from "@/lib/utils/slugify";

/** Admin UI for importing an external URL and auto-filling resource metadata via Claude. */
export default function NewResourcePage() {
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [tags, setTags] = useState("");
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imported, setImported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = slugify(title);
  const coverSrc = slug ? generateCoverDataURI(slug) : null;

  async function importUrl() {
    if (!url.trim()) return;
    setImporting(true);
    setError(null);
    setImported(false);

    try {
      const res = await fetch("/api/admin/import-resource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const json = await res.json() as {
        title?: string;
        excerpt?: string;
        tags?: string[];
        sourceName?: string;
        error?: { message: string };
      };

      if (!res.ok || json.error) {
        setError(json.error?.message ?? "Import failed.");
        return;
      }

      if (json.title) setTitle(json.title);
      if (json.excerpt) setExcerpt(json.excerpt);
      if (json.sourceName) setSourceName(json.sourceName);
      if (json.tags) setTags(json.tags.join(", "));
      setImported(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setImporting(false);
    }
  }

  async function save(status: "draft" | "published") {
    if (!title.trim() || !url.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/publish-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          excerpt: excerpt.trim() || null,
          body: null,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          type: "resource",
          status,
          sourceUrl: url.trim(),
          sourceName: sourceName.trim() || null,
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
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-text-primary mb-8">Add Resource</h1>

      {error && (
        <div className="mb-6 p-4 rounded-card bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* URL import */}
      <div className="flex gap-3 mb-8">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.canada.ca/en/immigration-refugees-citizenship/…"
          className="flex-1 px-4 py-2.5 rounded-input border border-border bg-bg-surface text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-500 transition-colors duration-fast"
        />
        <button
          onClick={importUrl}
          disabled={importing || !url.trim()}
          className="px-5 py-2.5 rounded-btn bg-accent-500 text-white text-sm font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-fast shrink-0"
        >
          {importing ? "Fetching…" : "Import"}
        </button>
      </div>

      {imported && (
        <>
          <hr className="border-border mb-8" />

          <div className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-input border border-border bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-accent-500 transition-colors duration-fast"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">Source name</label>
              <input
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g. Government of Canada"
                className="w-full px-4 py-2.5 rounded-input border border-border bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-accent-500 transition-colors duration-fast"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">Summary</label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-input border border-border bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-accent-500 transition-colors duration-fast resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">Tags (comma-separated)</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-4 py-2.5 rounded-input border border-border bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-accent-500 transition-colors duration-fast"
              />
            </div>

            {coverSrc && (
              <div>
                <p className="text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">Cover art</p>
                <img src={coverSrc} alt="Generated cover" className="w-full aspect-video rounded-card object-cover" />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => save("draft")}
                disabled={saving || !title.trim()}
                className="flex-1 py-2.5 rounded-btn border border-border text-sm text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-fast"
              >
                {saving ? "Saving…" : "Save Draft"}
              </button>
              <button
                onClick={() => save("published")}
                disabled={saving || !title.trim()}
                className="flex-1 py-2.5 rounded-btn bg-text-primary text-white text-sm hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-fast"
              >
                {saving ? "Publishing…" : "Publish"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
