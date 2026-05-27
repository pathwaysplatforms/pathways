import Link from "next/link";
import { ShieldCheck, BookOpen, RefreshCw } from "lucide-react";
import { LoginForm } from "./login-form";
import { getT } from "@/lib/i18n";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const t = await getT();
  const { error } = await searchParams;

  function resolveErrorMessage(e: string | undefined): string | null {
    if (!e) return null;
    if (e === "expired") return t("auth_error_expired");
    if (e === "invalid") return t("auth_error_invalid");
    return t("auth_error_generic");
  }

  const errorMessage = resolveErrorMessage(error);

  return (
    <main className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo + tagline */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-bold text-text-primary tracking-tight">Pathways</span>
          </Link>
          <p className="mt-2 text-sm text-text-secondary">
            {t("auth_subtitle")}
          </p>
        </div>

        {/* Auth card */}
        <div className="card p-8">
          <LoginForm errorMessage={errorMessage} />
        </div>

        {/* Trust chips */}
        <div className="space-y-2">
          {[
            { icon: ShieldCheck, text: t("landing_trust_1") },
            { icon: BookOpen, text: t("landing_trust_2") },
            { icon: RefreshCw, text: t("landing_trust_3") },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-xs text-text-tertiary">
              <Icon size={13} className="text-accent-500 shrink-0" />
              {text}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
