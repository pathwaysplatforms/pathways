import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils/format-date";
import type { Tables } from "@/types/database";

type Post = Tables<"posts">;

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string }>;
}

/** Admin post list — filterable by status and searchable by title. */
export default async function AdminBlogPage({ searchParams: searchParamsPromise }: PageProps) {
  const searchParams = await searchParamsPromise;
  const db = createSupabaseAdminClient() as unknown as SupabaseClient;

  let query = db
    .from("posts")
    .select("id, title, slug, type, status, published_at")
    .order("created_at", { ascending: false });

  if (searchParams.status && searchParams.status !== "all") {
    query = query.eq("status", searchParams.status);
  }
  if (searchParams.q) {
    query = query.ilike("title", `%${searchParams.q}%`);
  }

  const { data } = await query;
  const posts = (data ?? []) as Pick<Post, "id" | "title" | "slug" | "type" | "status" | "published_at">[];

  function filterUrl(params: Record<string, string>) {
    const p = new URLSearchParams({ ...searchParams, ...params });
    return `/admin/blog?${p.toString()}`;
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Blog &amp; Resources</h1>
          <p className="text-text-secondary text-sm mt-1">{posts.length} post{posts.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/resources/new"
            className="px-4 py-2 rounded-btn border border-border text-sm text-text-secondary hover:text-text-primary transition-colors duration-fast"
          >
            Add Resource
          </Link>
          <Link
            href="/admin/blog/new"
            className="px-4 py-2 rounded-btn bg-accent-500 text-white text-sm hover:bg-accent-600 transition-colors duration-fast"
          >
            New Article
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-1 p-1 bg-bg-subtle rounded-pill w-fit text-sm">
          {(["all", "draft", "published"] as const).map((s) => (
            <Link
              key={s}
              href={filterUrl({ status: s })}
              className={`px-4 py-1.5 rounded-pill capitalize transition-colors duration-fast ${
                (searchParams.status ?? "all") === s
                  ? "bg-text-primary text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
        <form method="GET" action="/admin/blog" className="flex-1 max-w-xs">
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search by title…"
            className="w-full px-4 py-2 rounded-input border border-border text-sm bg-bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-500 transition-colors duration-fast"
          />
        </form>
      </div>

      {/* Table */}
      {posts.length === 0 ? (
        <div className="text-center py-20 text-text-tertiary text-sm">No posts found.</div>
      ) : (
        <div className="bg-bg-surface rounded-card border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-subtle">
                <th className="text-left px-6 py-3 font-medium text-text-secondary">Title</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Type</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Status</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Published</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-bg-subtle transition-colors duration-fast">
                  <td className="px-6 py-4 font-medium text-text-primary max-w-xs truncate">
                    {post.title}
                  </td>
                  <td className="px-4 py-4 text-text-secondary capitalize">{post.type}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-badge text-xs font-medium ${
                        post.status === "published"
                          ? "bg-status-success-bg text-status-success-text"
                          : "bg-bg-subtle text-text-tertiary"
                      }`}
                    >
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-text-tertiary">
                    {post.published_at ? formatDate(post.published_at) : "—"}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3 justify-end">
                      <Link
                        href={`/resources/${post.slug}`}
                        target="_blank"
                        className="text-text-tertiary hover:text-text-primary transition-colors duration-fast"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
