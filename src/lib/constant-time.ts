import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compare two strings in constant time to avoid leaking their contents via
 * timing side-channels. Both inputs are hashed to a fixed-length digest first,
 * so neither the length nor the value influences the comparison time.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a, "utf8").digest();
  const digestB = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(digestA, digestB);
}
