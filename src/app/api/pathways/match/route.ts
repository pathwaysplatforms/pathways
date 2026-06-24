/**
 * GET  /api/pathways/match  — return the most recent cached match result
 * POST /api/pathways/match  — run the matching pipeline and return result
 *
 * The POST caches for 1 hour: if a match was run within the past hour it is
 * returned directly without calling OpenAI or Claude again.
 */

import type { NextRequest } from "next/server";
import type { Logger } from "pino";
import { createRequestLogger } from "@/lib/logger";
import { requireAuth, getProfile } from "@/modules/auth/service";
import { matchPathways, getCachedMatch } from "@/lib/pathway-matcher";
import { PathwaysError } from "@/lib/errors";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    const cause = error.cause as { status?: number; message?: string } | undefined;
    log.error({
      action: "api.pathways.match.error",
      code: error.code,
      message: error.message,
      causeStatus: cause?.status,
      causeMessage: cause?.message,
    });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({ action: "api.pathways.match.error", error: String(error) });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 }
  );
}

/** Return the most recent cached match result for the authenticated user. */
export async function GET(_req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.pathways.match.get.start" });

  try {
    await requireAuth();
    const profile = await getProfile();
    if (!profile) {
      return Response.json(
        { error: { code: "AUTH_ERROR", message: "Profile not found." } },
        { status: 401 }
      );
    }

    const cached = await getCachedMatch(profile.id);
    log.info({ action: "api.pathways.match.get.done", found: cached !== null });

    if (!cached) {
      return Response.json({ data: null }, { status: 200 });
    }

    return Response.json({ data: cached }, { status: 200 });
  } catch (error) {
    return handleError(error, log);
  }
}

/** Run the matching pipeline (or return cache if fresh enough). */
export async function POST(_req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.pathways.match.post.start" });

  try {
    await requireAuth();
    const profile = await getProfile();
    if (!profile) {
      return Response.json(
        { error: { code: "AUTH_ERROR", message: "Profile not found." } },
        { status: 401 }
      );
    }

    // Check for a recent cached result (within 1 hour)
    const cached = await getCachedMatch(profile.id);
    if (cached) {
      const matchedAt = new Date(cached.matched_at).getTime();
      const age = Date.now() - matchedAt;
      if (age < CACHE_TTL_MS) {
        log.info({ action: "api.pathways.match.post.cache_hit", ageMs: age });
        return Response.json({ data: cached }, { status: 200 });
      }
    }

    const result = await matchPathways(profile.id, log);
    log.info({ action: "api.pathways.match.post.done" });

    return Response.json({ data: result }, { status: 200 });
  } catch (error) {
    return handleError(error, log);
  }
}
