"use client";

/** Persist a delta of onboarding fields to the guest session via API. Fire-and-forget. */
export async function updateGuestOnboardingData(
  token: string,
  delta: Record<string, unknown>
): Promise<void> {
  await fetch(`/api/guest/${token}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ onboarding_data: delta }),
  });
}
