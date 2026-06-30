import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/BackButton";
import { generateCoverDataURI } from "@/lib/cover-art";
import { formatDate } from "@/lib/utils/format-date";
import { readingTime } from "@/lib/utils/reading-time";
import { PostCard } from "@/components/resources/PostCard";
import type { Tables } from "@/types/database";

export const revalidate = 3600;

type Post = Tables<"posts">;

interface PageProps {
  params: { slug: string };
}

function getDb() {
  return createSupabaseServerClient() as unknown as SupabaseClient;
}

/** Generates static paths for all published posts at build time. */
export async function generateStaticParams() {
  const db = getDb();
  const { data } = await db.from("posts").select("slug").eq("status", "published");
  return (data ?? []).map((p: { slug: string }) => ({ slug: p.slug }));
}

/** Generates per-post OG metadata for social sharing. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const db = getDb();
  const { data } = await db
    .from("posts")
    .select("title, excerpt, slug, tags")
    .eq("slug", params.slug)
    .single();

  if (!data) return {};
  const post = data as Pick<Post, "title" | "excerpt" | "slug" | "tags">;

  return {
    title: `${post.title} — Pathways`,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: "article",
      tags: post.tags ?? [],
    },
  };
}

/** Individual post or resource page with markdown body and related articles. */
export default async function PostPage({ params }: PageProps) {
  const db = getDb();

  const { data } = await db
    .from("posts")
    .select("*")
    .eq("slug", params.slug)
    .eq("status", "published")
    .single();

  if (!data) notFound();
  const post = data as Post;

  // Related posts (same type, any overlapping tag, exclude self)
  const tags = post.tags ?? [];
  const { data: related } = await db
    .from("posts")
    .select("id, title, slug, excerpt, cover_seed, tags, type, source_name, published_at, body")
    .eq("status", "published")
    .eq("type", post.type)
    .neq("id", post.id)
    .contains("tags", tags.slice(0, 1))
    .order("published_at", { ascending: false })
    .limit(3);

  const relatedPosts = (related ?? []) as Post[];
  const coverSrc = generateCoverDataURI(post.cover_seed ?? post.slug);

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Cover image */}
      <div className="w-full aspect-[21/6] overflow-hidden bg-bg-muted">
        <img
          src={coverSrc}
          alt=""
          aria-hidden="true"
          width={1600}
          height={420}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="max-w-3xl mx-auto px-gutter-lg py-12">
        <BackButton href="/resources" />
        {/* Meta */}
        <div className="mb-6">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-medium text-accent-700 bg-accent-50 px-3 py-1 rounded-pill"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <h1 className="text-3xl font-bold text-text-primary leading-tight mb-4">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-text-tertiary">
            {post.published_at && <time>{formatDate(post.published_at)}</time>}
            {post.type === "article" && post.body && (
              <span>{readingTime(post.body)} min read</span>
            )}
            {post.type === "resource" && post.source_name && (
              <span className="flex items-center gap-1">
                <ExternalLink size={12} />
                {post.source_name}
              </span>
            )}
          </div>
        </div>

        <hr className="border-border mb-8" />

        {/* Body — article */}
        {post.type === "article" && post.body && (
          <div className="prose prose-sm max-w-none text-text-secondary leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body}</ReactMarkdown>
          </div>
        )}

        {/* Body — external resource */}
        {post.type === "resource" && (
          <div>
            {post.ai_summary && (
              <p className="text-text-secondary leading-relaxed mb-8">{post.ai_summary}</p>
            )}
            {post.excerpt && !post.ai_summary && (
              <p className="text-text-secondary leading-relaxed mb-8">{post.excerpt}</p>
            )}
            {post.source_url && (
              <a
                href={post.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-btn bg-accent-500 text-white text-sm font-medium hover:bg-accent-600 transition-colors duration-fast"
              >
                Visit Source
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        )}

        {/* Related */}
        {relatedPosts.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xl font-semibold text-text-primary mb-6">Related</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {relatedPosts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
