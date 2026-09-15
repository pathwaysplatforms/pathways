import { describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import {
  INTENTIONAL_EXTRAS,
  SYSTEM_MANAGED_COLUMNS,
  WRITABLE_PROFILE_COLUMNS,
  partitionProfilePayload,
} from "@/lib/profile-columns";
import { ConfirmRequestSchema, VoiceExtractedProfileSchema } from "@/modules/voice/types";

/** Minimal pino stand-in so tests can assert on warn calls without real log output. */
function stubLogger() {
  return { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Logger & {
    warn: ReturnType<typeof vi.fn>;
  };
}

const ONBOARDING_KEYS = Object.keys(
  VoiceExtractedProfileSchema.omit({ requires_review: true }).shape
);

describe("profile column lists", () => {
  it("accepts every key the onboarding schema can produce", () => {
    const accepted = new Set<string>([...WRITABLE_PROFILE_COLUMNS, ...INTENTIONAL_EXTRAS]);
    const unaccounted = ONBOARDING_KEYS.filter((key) => !accepted.has(key));
    expect(unaccounted).toEqual([]);
  });

  it("accepts every key the voice confirm schema can produce", () => {
    const accepted = new Set<string>([...WRITABLE_PROFILE_COLUMNS, ...INTENTIONAL_EXTRAS]);
    const confirmKeys = Object.keys(ConfirmRequestSchema.shape.updates.shape);
    expect(confirmKeys.filter((key) => !accepted.has(key))).toEqual([]);
  });

  it("never lets a column sit in both the writable and system-managed lists", () => {
    const systemManaged = new Set<string>(SYSTEM_MANAGED_COLUMNS);
    expect(WRITABLE_PROFILE_COLUMNS.filter((column) => systemManaged.has(column))).toEqual([]);
  });

  it("lists no duplicates within either partition", () => {
    expect(new Set(WRITABLE_PROFILE_COLUMNS).size).toBe(WRITABLE_PROFILE_COLUMNS.length);
    expect(new Set(SYSTEM_MANAGED_COLUMNS).size).toBe(SYSTEM_MANAGED_COLUMNS.length);
    expect(new Set(INTENTIONAL_EXTRAS).size).toBe(INTENTIONAL_EXTRAS.length);
  });
});

describe("partitionProfilePayload", () => {
  it("routes columns, extras, and unknown keys to their own buckets", () => {
    const log = stubLogger();
    const result = partitionProfilePayload(
      {
        full_name: "Amara Okafor",
        clb_speaking: 9,
        destination_country: "Canada",
        favourite_colour: "teal",
      },
      log
    );

    expect(result.columns).toEqual({ full_name: "Amara Okafor", clb_speaking: 9 });
    expect(result.extras).toEqual({ destination_country: "Canada" });
    expect(result.rejected).toEqual(["favourite_colour"]);
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it("rejects system-managed columns instead of writing them", () => {
    const log = stubLogger();
    const result = partitionProfilePayload(
      { is_admin: true, subscription_status: "paid", id: "spoofed", occupation: "Nurse" },
      log
    );

    expect(result.columns).toEqual({ occupation: "Nurse" });
    expect(result.rejected).toEqual(["is_admin", "subscription_status", "id"]);
  });

  it("keeps null and undefined values that the onboarding schema allows", () => {
    const result = partitionProfilePayload(
      { nationality: null, intended_province: undefined },
      stubLogger()
    );

    expect(result.columns).toEqual({ nationality: null, intended_province: undefined });
    expect(result.rejected).toEqual([]);
  });

  it("returns an empty partition for an empty payload without warning", () => {
    const log = stubLogger();
    const result = partitionProfilePayload({}, log);

    expect(result).toEqual({ columns: {}, extras: {}, rejected: [] });
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("returns an empty partition rather than throwing on non-object input", () => {
    for (const input of [null, undefined, "full_name", 42, ["full_name"]]) {
      const log = stubLogger();
      expect(partitionProfilePayload(input, log)).toEqual({
        columns: {},
        extras: {},
        rejected: [],
      });
      expect(log.warn).toHaveBeenCalledTimes(1);
    }
  });
});
