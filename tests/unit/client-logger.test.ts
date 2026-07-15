import { describe, it, expect, vi, beforeEach } from "vitest";

const captureMessage = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...args: unknown[]) => captureMessage(...args),
}));

import { createClientLogger } from "@/lib/client-logger";

describe("createClientLogger", () => {
  beforeEach(() => {
    captureMessage.mockClear();
  });

  it("routes errors to Sentry with a scoped event name and extra fields", () => {
    const log = createClientLogger("voice-tab");
    log.error({ action: "connect.error", error: "boom" });
    expect(captureMessage).toHaveBeenCalledWith("voice-tab.connect.error", {
      level: "error",
      extra: { error: "boom" },
    });
  });

  it("routes warnings to Sentry at warning level", () => {
    const log = createClientLogger("guest-voice-tab");
    log.warn({ action: "retrying", attempt: 2 });
    expect(captureMessage).toHaveBeenCalledWith("guest-voice-tab.retrying", {
      level: "warning",
      extra: { attempt: 2 },
    });
  });

  it("does not send info or debug events to Sentry", () => {
    const log = createClientLogger("voice-tab");
    log.info({ action: "started" });
    log.debug({ action: "tick" });
    expect(captureMessage).not.toHaveBeenCalled();
  });
});
