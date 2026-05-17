import { type NextRequest } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { requireAuth } from "@/modules/auth/service";
import { PathwaysError } from "@/lib/errors";
import type { Logger } from "pino";

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({ action: "api.voice.deepgram-token.error", code: error.code, message: error.message });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({ action: "api.voice.deepgram-token.error", error: String(error) });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 }
  );
}

/** Return a short-lived Deepgram API key for client-side live transcription. */
export async function GET(_req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.voice.deepgram-token.start" });

  try {
    await requireAuth();

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPGRAM_API_KEY is not set");
    }

    // Fetch project ID
    const projectsRes = await fetch("https://api.deepgram.com/v1/projects", {
      headers: { Authorization: `Token ${apiKey}` },
    });

    if (!projectsRes.ok) {
      throw new Error(`Deepgram projects fetch failed: ${projectsRes.status}`);
    }

    const projectsData = (await projectsRes.json()) as { projects: { project_id: string }[] };
    const projectId = projectsData.projects[0]?.project_id;
    if (!projectId) {
      throw new Error("No Deepgram projects found");
    }

    // Create a temporary key with a short TTL
    const keyRes = await fetch(
      `https://api.deepgram.com/v1/projects/${projectId}/keys`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment: "Voice session browser key",
          scopes: ["usage:write"],
          time_to_live_in_seconds: 30,
        }),
      }
    );

    if (!keyRes.ok) {
      throw new Error(`Deepgram key creation failed: ${keyRes.status}`);
    }

    const keyData = (await keyRes.json()) as { key: string };

    log.info({ action: "api.voice.deepgram-token.done" });
    return Response.json({ token: keyData.key });
  } catch (error) {
    return handleError(error, log);
  }
}
