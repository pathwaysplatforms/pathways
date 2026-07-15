import { describe, it, expect } from "vitest";
import { constantTimeEqual } from "@/lib/constant-time";

describe("constantTimeEqual", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeEqual("super-secret-value", "super-secret-value")).toBe(true);
  });

  it("returns false for different strings of equal length", () => {
    expect(constantTimeEqual("super-secret-valuA", "super-secret-valuB")).toBe(false);
  });

  it("returns false for different-length strings without throwing", () => {
    expect(constantTimeEqual("short", "a-much-longer-secret")).toBe(false);
    expect(constantTimeEqual("", "nonempty")).toBe(false);
  });
});
