import { describe, it, expect, beforeEach } from "vitest";
import {
  GUEST_TOKEN_KEY,
  setGuestToken,
  getGuestToken,
  clearGuestTokenAfterMigration,
} from "@/lib/guest-session";

describe("clearGuestTokenAfterMigration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clears the token when the post-migration welcome=1 signal is present", () => {
    setGuestToken("guest-token-123");
    window.history.replaceState({}, "", "/dashboard?welcome=1");

    clearGuestTokenAfterMigration();

    expect(getGuestToken()).toBeNull();
    expect(localStorage.getItem(GUEST_TOKEN_KEY)).toBeNull();
  });

  it("leaves the token untouched when welcome is absent", () => {
    setGuestToken("guest-token-123");
    window.history.replaceState({}, "", "/dashboard");

    clearGuestTokenAfterMigration();

    expect(getGuestToken()).toBe("guest-token-123");
  });

  it("leaves the token untouched for a non-matching welcome value", () => {
    setGuestToken("guest-token-123");
    window.history.replaceState({}, "", "/dashboard?welcome=0");

    clearGuestTokenAfterMigration();

    expect(getGuestToken()).toBe("guest-token-123");
  });
});
