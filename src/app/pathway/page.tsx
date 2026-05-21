import { TopNav } from "@/components/layout/TopNav";
import Link from "next/link";

/** Stub page for /pathway — coming soon. */
export default function PathwayPage() {
  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-bg-dashboard flex flex-col items-center justify-center gap-4">
        <h1 className="font-jakarta text-2xl text-neutral-900">My Pathway — coming soon</h1>
        <Link href="/dashboard" className="font-dm-sans text-sm text-pine underline underline-offset-2">
          ← Back to Dashboard
        </Link>
      </main>
    </>
  );
}
