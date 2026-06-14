import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { requireAdmin } from "@/modules/auth/service";

const RequestSchema = z.object({
  url: z.string().url(),
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Fetch a URL, strip HTML, and return Claude-generated title/excerpt/tags. */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.admin.import-resource.start" });

  try {
    await requireAdmin();
  } catch {
    log.warn({ action: "api.admin.import-resource.unauthorized" });
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
    log.warn({ action: "api.admin.import-resource.validation_error" });
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "A valid URL is required." } },
      { status: 422 }
    );
  }

  const { url } = parsed.data;

  let pageText = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Pathways/1.0 (+https://pathways.app)" },
    });
    const html = await res.text();
    pageText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
  } catch (err) {
    log.warn({ action: "api.admin.import-resource.fetch_failed", url, error: String(err) });
    return Response.json(
      { error: { code: "FETCH_ERROR", message: "Could not fetch that URL." } },
      { status: 400 }
    );
  }

  const sourceName = new URL(url).hostname.replace("www.", "");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `You are helping curate immigration resources for a platform called Pathways.

Here is the text content of a web page:
---
${pageText}
---

Return ONLY a JSON object (no markdown, no preamble) with these fields:
{
  "title": "A clear, descriptive title for this resource (max 80 chars)",
  "excerpt": "A 2-3 sentence summary of what this resource covers and why it is useful for someone navigating immigration (max 200 chars)",
  "tags": ["tag1", "tag2", "tag3"]
}

Use only tags from this list: ["Express Entry", "PNP", "Canada", "Study Permit", "Work Permit", "Family Sponsorship", "CRS Score", "Documents", "Timeline", "Costs", "IRCC"]`,
      },
    ],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";

  try {
    const extracted = JSON.parse(text) as { title: string; excerpt: string; tags: string[] };
    log.info({ action: "api.admin.import-resource.done", url });
    return Response.json({ ...extracted, sourceName, sourceUrl: url });
  } catch {
    log.error({ action: "api.admin.import-resource.parse_failed", text });
    return Response.json(
      { error: { code: "PARSE_ERROR", message: "Could not parse resource data from AI response." } },
      { status: 500 }
    );
  }
}
