import { type NextRequest } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { requireAuth, getProfile } from "@/modules/auth/service";
import { confirmVoiceProfile } from "@/modules/voice/service";
import { ConfirmRequestSchema } from "@/modules/voice/types";
import { PathwaysError, AuthError, ValidationError } from "@/lib/errors";
import type { Logger } from "pino";

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({ action: "api.voice.confirm.error", code: error.code, message: error.message });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({ action: "api.voice.confirm.error", error: String(error) });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 }
  );
}

/** Confirm the user's extracted profile (with any edits) and mark onboarding as complete. */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.voice.confirm.start" });

  try {
    await requireAuth();

    const profile = await getProfile();
    if (!profile) {
      throw new AuthError("Profile not found");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Request body must be valid JSON");
    }

    const parsed = ConfirmRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid request body", {
        errors: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      });
    }

    await confirmVoiceProfile(profile.id, parsed.data.updates, log);

    log.info({ action: "api.voice.confirm.done", profileId: profile.id });
    return Response.json({ success: true });
  } catch (error) {
    return handleError(error, log);
  }
}
