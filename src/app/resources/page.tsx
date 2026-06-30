import Link from "next/link";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PostCard } from "@/components/resources/PostCard";
import type { Tables } from "@/types/database";

type Post = Tables<"posts">;

export const metadata: Metadata = {
  title: "Resources & Articles — Pathways",
  description:
    "Immigration guides, visa explainers, CRS calculators, and curated resources to help you navigate your journey to Canada and beyond.",
};

const PAGE_SIZE = 9;

interface PageProps {
  searchParams: { tab?: string; page?: string };
}

/** Public resources & articles listing with tab navigation and URL-based pagination. */
export default async function ResourcesPage({ searchParams }: PageProps) {
  const activeType = searchParams.tab === "resources" ? "resource" : "article";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));

  const db = createSupabaseServerClient() as unknown as SupabaseClient;

  const { data: posts, count } = await db
    .from("posts")
    .select("id, title, slug, excerpt, cover_seed, tags, type, source_name, published_at, body", {
      count: "exact",
    })
    .eq("status", "published")
    .eq("type", activeType)
    .order("published_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const typedPosts = (posts ?? []) as Post[];
  const totalCount = count ?? 0;
  const hasMore = page * PAGE_SIZE < totalCount;
  const hasPrev = page > 1;

  function pageUrl(p: number) {
    const params = new URLSearchParams({ tab: searchParams.tab ?? "articles", page: String(p) });
    return `/resources?${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-6xl mx-auto px-gutter-lg py-12">

        {/* Header */}
        <div className="mb-10">
          <p className="label-eyebrow mb-2">Knowledge Base</p>
          <h1 className="text-4xl font-bold text-text-primary leading-tight mb-3">
            Resources &amp; Articles
          </h1>
          <p className="text-text-secondary text-base max-w-xl leading-relaxed">
            Immigration guides, visa explainers, and curated resources to help you navigate your journey.
          </p>
        </div>

        {/* Tab switcher */}
        <nav aria-label="Content tabs" className="mb-8 flex gap-1 p-1 bg-bg-subtle rounded-pill w-fit">
          <Link
            href="/resources?tab=articles"
            className={`px-6 py-2 rounded-pill text-sm font-medium transition-colors duration-fast ${
              activeType === "article"
                ? "bg-text-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Articles
          </Link>
          <Link
            href="/resources?tab=resources"
            className={`px-6 py-2 rounded-pill text-sm font-medium transition-colors duration-fast ${
              activeType === "resource"
                ? "bg-text-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Resources
          </Link>
        </nav>

        {/* Grid */}
        {typedPosts.length === 0 ? (
          <div className="text-center py-20 text-text-tertiary">
            <p className="text-base">No {activeType === "article" ? "articles" : "resources"} published yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {typedPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {(hasMore || hasPrev) && (
          <div className="mt-12 flex items-center justify-center gap-4">
            {hasPrev && (
              <Link
                href={pageUrl(page - 1)}
                className="px-6 py-2.5 rounded-btn border border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors duration-fast"
              >
                ← Previous
              </Link>
            )}
            {hasMore && (
              <Link
                href={pageUrl(page + 1)}
                className="px-6 py-2.5 rounded-btn bg-text-primary text-white text-sm hover:bg-accent-700 transition-colors duration-fast"
              >
                Load more
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
