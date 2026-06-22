import type { NextRequest } from "next/server";
import { z } from "zod";
import { createRequestLogger } from "@/lib/logger";
import { getGuestSession, saveGuestPathwayResults } from "@/modules/guest/service";
import { matchPathwaysForGuest } from "@/lib/pathway-matcher";
import { PathwaysError } from "@/lib/errors";

const BodySchema = z.object({ token: z.string().min(10) });

/** Run the pathway matcher for a guest session and save results. */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.guest.match.start" });

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

  const { token } = parsed.data;

  try {
    const session = await getGuestSession(token, log);
    const results = await matchPathwaysForGuest(session.onboarding_data, session.session_token, log);
    const updated = await saveGuestPathwayResults(token, results, log);

    log.info({ action: "api.guest.match.done", token });
    return Response.json({ results: updated.pathway_results });
  } catch (err) {
    const code = err instanceof PathwaysError ? err.code : "INTERNAL_ERROR";
    const status = err instanceof PathwaysError ? err.statusCode : 500;
    log.error({ action: "api.guest.match.error", error: String(err) });
    return Response.json({ error: { code, message: String(err) } }, { status });
  }
}
