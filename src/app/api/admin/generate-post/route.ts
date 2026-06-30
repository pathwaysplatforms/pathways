import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { requireAdmin } from "@/modules/auth/service";

const RequestSchema = z.object({
  topic: z.string().min(1).max(500),
  tags: z.array(z.string()).optional(),
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Stream a Claude-generated immigration blog post for a given topic. */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.admin.generate-post.start" });

  try {
    await requireAdmin();
  } catch {
    log.warn({ action: "api.admin.generate-post.unauthorized" });
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
    log.warn({ action: "api.admin.generate-post.validation_error", errors: parsed.error.errors });
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid input." } },
      { status: 422 }
    );
  }

  const { topic, tags } = parsed.data;

  const stream = anthropic.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Write a detailed, helpful blog post for an immigration platform called Pathways.

Topic: ${topic}
Tags: ${tags?.join(", ") ?? "immigration, Canada"}

Format the response as clean markdown with:
- A compelling H1 title
- An intro paragraph
- 3-5 H2 sections with substantive content
- A conclusion with a clear next step

Tone: Clear, trustworthy, and reassuring. Written for someone navigating immigration for the first time.
Length: 600-900 words.
Do not include any preamble — start directly with the # Title.
Do not include legal advice — add a brief disclaimer at the end.`,
      },
    ],
  });

  log.info({ action: "api.admin.generate-post.streaming", topic });
  return new Response(stream.toReadableStream());
}
