import Link from "next/link";
import { LoginForm } from "./login-form";
import { getT } from "@/lib/i18n";
import { ParticleField } from "@/components/fx/ParticleField";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

/** Passwordless auth page — white background, floating form, underline inputs. */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const t = await getT();
  const { error } = await searchParams;

  function resolveErrorMessage(e: string | undefined): string | null {
    if (!e) return null;
    if (e === "expired") return t("auth_error_expired");
    if (e === "invalid")  return t("auth_error_invalid");
    return t("auth_error_generic");
  }

  const errorMessage = resolveErrorMessage(error);

  return (
    <main
      className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden"
      style={{ background: "var(--pw-bg)", fontFamily: "var(--pw-font-body)" }}
    >
      <ParticleField density={0.4} opacity={0.04} parallax={8} />
      <div className="relative w-full max-w-sm space-y-10">

        {/* Wordmark */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <span
              className="text-2xl text-pw-ink"
              style={{ fontFamily: "var(--pw-font-display)" }}
            >
              Pathways
            </span>
          </Link>
          <p className="mt-3 text-sm text-pw-muted">{t("auth_subtitle")}</p>
        </div>

        {/* Form — floats on white, no card border */}
        <LoginForm errorMessage={errorMessage} />

      </div>
    </main>
  );
}
