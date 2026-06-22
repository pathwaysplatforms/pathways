import type { NextRequest } from "next/server";
import { z } from "zod";
import { createRequestLogger } from "@/lib/logger";
import { updateGuestOnboardingData } from "@/modules/guest/service";
import { PathwaysError } from "@/lib/errors";

const PatchSchema = z.object({
  onboarding_data: z.record(z.unknown()),
});

/** Merge onboarding field deltas into the guest session. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { token: string } }
): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.guest.patch.start", token: params.token });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON." } }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid input." } },
      { status: 422 }
    );
  }

  try {
    const session = await updateGuestOnboardingData(params.token, parsed.data.onboarding_data, log);
    log.info({ action: "api.guest.patch.done", token: params.token });
    return Response.json({ session_token: session.session_token, onboarding_data: session.onboarding_data });
  } catch (err) {
    const code = err instanceof PathwaysError ? err.code : "INTERNAL_ERROR";
    const status = err instanceof PathwaysError ? err.statusCode : 500;
    log.error({ action: "api.guest.patch.error", error: String(err) });
    return Response.json({ error: { code, message: String(err) } }, { status });
  }
}
