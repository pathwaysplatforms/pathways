import { describe, it, expect } from "vitest";
import { Writable } from "node:stream";
import type { DestinationStream } from "pino";
import { createLogger, createRequestLogger, maskToken } from "@/lib/logger";

function makeStream() {
  let output = "";
  const writable = new Writable({
    write(chunk: Buffer, _: string, cb: () => void) {
      output += chunk.toString();
      cb();
    },
  });
  return {
    stream: writable as unknown as DestinationStream,
    getOutput: () => output,
  };
}

describe("logger", () => {
  it("includes service='pathways-api' in JSON output", () => {
    const { stream, getOutput } = makeStream();
    const log = createLogger(stream);
    log.info("test message");
    const line = JSON.parse(getOutput().trim());
    expect(line.service).toBe("pathways-api");
  });

  it("includes env field in JSON output", () => {
    const { stream, getOutput } = makeStream();
    const log = createLogger(stream);
    log.info("test");
    const line = JSON.parse(getOutput().trim());
    expect(line).toHaveProperty("env");
  });

  it("includes msg field in JSON output", () => {
    const { stream, getOutput } = makeStream();
    const log = createLogger(stream);
    log.info("hello world");
    const line = JSON.parse(getOutput().trim());
    expect(line.msg).toBe("hello world");
  });

  it("createRequestLogger adds correlationId to child bindings", () => {
    const reqLogger = createRequestLogger("req-abc-123");
    expect(reqLogger.bindings()).toMatchObject({ correlationId: "req-abc-123" });
  });

  it("redacts secret and PII fields at the top level and one level deep", () => {
    const { stream, getOutput } = makeStream();
    const log = createLogger(stream);
    log.info({
      token: "raw-secret-token",
      email: "jane@example.com",
      nested: { session_token: "raw-session-token" },
      safe: "keep-me",
    });
    const line = JSON.parse(getOutput().trim());
    expect(line.token).toBe("[redacted]");
    expect(line.email).toBe("[redacted]");
    expect(line.nested.session_token).toBe("[redacted]");
    expect(line.safe).toBe("keep-me");
  });

  it("leaves masked token prefixes intact (tokenPrefix is not redacted)", () => {
    const { stream, getOutput } = makeStream();
    const log = createLogger(stream);
    log.info({ tokenPrefix: "a1b2c3…" });
    const line = JSON.parse(getOutput().trim());
    expect(line.tokenPrefix).toBe("a1b2c3…");
  });
});

describe("maskToken", () => {
  it("returns only a short non-reversible prefix for a full token", () => {
    const masked = maskToken("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    expect(masked).toBe("a1b2c3…");
    expect(masked).not.toContain("ef1234567890");
  });

  it("fully obscures short tokens without leaking the prefix", () => {
    expect(maskToken("short")).toBe("***");
    expect(maskToken("12345678")).toBe("***");
  });

  it("returns a placeholder for null or undefined", () => {
    expect(maskToken(null)).toBe("(none)");
    expect(maskToken(undefined)).toBe("(none)");
    expect(maskToken("")).toBe("(none)");
  });
});
