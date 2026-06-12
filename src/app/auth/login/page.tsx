import Link from "next/link";
import { ShieldCheck, BookOpen, RefreshCw } from "lucide-react";
import { LoginForm } from "./login-form";
import { getT } from "@/lib/i18n";

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
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--pw-bg)", fontFamily: "var(--pw-font-body)" }}
    >
      <div className="w-full max-w-sm space-y-10">

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

        {/* Trust row */}
        <div className="space-y-3">
          {[
            { icon: ShieldCheck, text: t("landing_trust_1") },
            { icon: BookOpen,    text: t("landing_trust_2") },
            { icon: RefreshCw,  text: t("landing_trust_3") },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-xs text-pw-muted">
              <Icon size={13} className="text-pw-accent shrink-0" />
              {text}
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
