import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { generateCoverDataURI } from "@/lib/cover-art";
import { readingTime } from "@/lib/utils/reading-time";
import { formatDate } from "@/lib/utils/format-date";
import type { Tables } from "@/types/database";

type Post = Tables<"posts">;

interface PostCardProps {
  post: Post;
}

/** Card used in the public resources grid — renders cover art, tags, title, excerpt, and footer meta. */
export function PostCard({ post }: PostCardProps) {
  const coverSrc = generateCoverDataURI(post.cover_seed ?? post.slug);
  const tags = post.tags ?? [];

  return (
    <Link href={`/resources/${post.slug}`} className="group block">
      <article className="rounded-card overflow-hidden border border-border bg-bg-surface hover:shadow-card-md hover:-translate-y-0.5 transition-all duration-normal">
        {/* Cover art */}
        <div className="aspect-video overflow-hidden">
          <img
            src={coverSrc}
            alt=""
            aria-hidden="true"
            width={800}
            height={420}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-slow"
          />
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-medium text-accent-700 bg-accent-50 px-3 py-1 rounded-pill"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h2 className="font-sans text-lg font-medium text-text-primary leading-snug mb-3 group-hover:text-accent-600 transition-colors duration-fast">
            {post.title}
          </h2>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-text-secondary text-sm leading-relaxed mb-4 line-clamp-2">
              {post.excerpt}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            {post.published_at && (
              <time className="text-xs text-text-tertiary">
                {formatDate(post.published_at)}
              </time>
            )}
            {post.type === "resource" && post.source_name && (
              <span className="text-xs text-text-tertiary flex items-center gap-1">
                <ExternalLink size={10} />
                {post.source_name}
              </span>
            )}
            {post.type === "article" && (
              <span className="text-xs text-text-tertiary">
                {readingTime(post.body)} min read
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
