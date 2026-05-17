import { VoiceClient } from "./voice-client";

/** Full-screen voice onboarding interface — no sidebar, no nav. */
export default function VoicePage() {
  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center bg-neutral-50">
      <VoiceClient />
    </main>
  );
}
