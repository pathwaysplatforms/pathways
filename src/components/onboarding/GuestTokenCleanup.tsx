"use client";

import { useEffect } from "react";
import { clearGuestTokenAfterMigration } from "@/lib/guest-session";

/**
 * Renders nothing. Clears the stale guest token from localStorage after a
 * guest→account migration lands on the dashboard (see clearGuestTokenAfterMigration).
 */
export function GuestTokenCleanup(): null {
  useEffect(() => {
    clearGuestTokenAfterMigration();
  }, []);
  return null;
}
