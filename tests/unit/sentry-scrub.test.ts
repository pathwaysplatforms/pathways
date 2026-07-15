import { describe, it, expect } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

function makeEvent(partial: Partial<ErrorEvent>): ErrorEvent {
  return { type: undefined, ...partial } as ErrorEvent;
}

describe("scrubSentryEvent", () => {
  it("removes request body, cookies, and auth headers", () => {
    const event = makeEvent({
      request: {
        url: "https://app.example.com/api/onboarding/confirm",
        data: { nationality: "Nigeria", passport: "A1234567" },
        cookies: { "sb-access-token": "secret" },
        headers: { authorization: "Bearer secret", "user-agent": "x" },
      },
    });

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.headers?.authorization).toBeUndefined();
    // Non-sensitive headers survive.
    expect(scrubbed.request?.headers?.["user-agent"]).toBe("x");
  });

  it("redacts guest tokens from the URL path and token query params", () => {
    const event = makeEvent({
      request: {
        url: "https://app.example.com/api/guest/a1b2c3d4-e5f6-7890-abcd-ef1234567890?token=deadbeefcafe",
        query_string: "token=deadbeefcafe&foo=bar",
      },
    });

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request?.url).toBe(
      "https://app.example.com/api/guest/[redacted]?token=[redacted]"
    );
    expect(scrubbed.request?.query_string).toBe("token=[redacted]&foo=bar");
  });

  it("reduces the user context to a bare id and tolerates a missing request", () => {
    const event = makeEvent({
      user: { id: "user-123", email: "jane@example.com", ip_address: "1.2.3.4" },
    });

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.user).toEqual({ id: "user-123" });
    // No request present — must not throw.
    expect(scrubbed.request).toBeUndefined();
  });
});
