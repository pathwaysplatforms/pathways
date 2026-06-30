import { z } from "zod";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRequestLogger } from "@/lib/logger";
import { requireAdmin } from "@/modules/auth/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils/slugify";

const RequestSchema = z.object({
  title: z.string().min(1).max(200),
  excerpt: z.string().max(500).nullable().optional(),
  body: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  type: z.enum(["article", "resource"]),
  status: z.enum(["draft", "published"]).default("draft"),
  sourceUrl: z.string().url().nullable().optional(),
  sourceName: z.string().max(100).nullable().optional(),
  aiSummary: z.string().nullable().optional(),
});

/** Insert a new post (draft or published) into the posts table. */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.admin.publish-post.start" });

  let user: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    user = await requireAdmin();
  } catch {
    log.warn({ action: "api.admin.publish-post.unauthorized" });
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Admin access required." } },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body." } },
      { status: 400 }
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    log.warn({ action: "api.admin.publish-post.validation_error", errors: parsed.error.errors });
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid input." } },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const slug = slugify(data.title);

  const db = createSupabaseServerClient() as unknown as SupabaseClient;
  const { data: post, error } = await db
    .from("posts")
    .insert({
      title: data.title,
      slug,
      excerpt: data.excerpt ?? null,
      body: data.body ?? null,
      cover_seed: slug,
      tags: data.tags,
      type: data.type,
      status: data.status,
      source_url: data.sourceUrl ?? null,
      source_name: data.sourceName ?? null,
      ai_summary: data.aiSummary ?? null,
      author_id: user.id,
      published_at: data.status === "published" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    log.error({ action: "api.admin.publish-post.db_error", error: error.message });
    return Response.json(
      { error: { code: "DATABASE_ERROR", message: error.message } },
      { status: 500 }
    );
  }

  log.info({ action: "api.admin.publish-post.done", slug, status: data.status });
  return Response.json({ post }, { status: 201 });
}
