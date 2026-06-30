import type { NextRequest } from "next/server";
import { z } from "zod";
import { createRequestLogger } from "@/lib/logger";
import { getSession } from "@/modules/auth/service";
import { migrateGuestSession } from "@/modules/guest/service";
import { PathwaysError, AuthError } from "@/lib/errors";

const BodySchema = z.object({ guest_token: z.string().min(10) });

/**
 * Migrate a guest session into the authenticated user's profile.
 * Called immediately after email+password signup from the results page.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.auth.migrate-guest.start" });

  const session = await getSession();
  if (!session) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated." } }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON." } }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid input." } },
      { status: 422 }
    );
  }

  try {
    await migrateGuestSession(parsed.data.guest_token, session.user.id, log);
    log.info({ action: "api.auth.migrate-guest.done" });
    return Response.json({ ok: true });
  } catch (err) {
    const code = err instanceof PathwaysError ? err.code : "INTERNAL_ERROR";
    const status = err instanceof PathwaysError ? err.statusCode : 500;
    log.error({ action: "api.auth.migrate-guest.error", error: String(err) });
    return Response.json({ error: { code, message: String(err) } }, { status });
  }
}
