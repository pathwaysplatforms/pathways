import Link from "next/link";
import { getT } from "@/lib/i18n";
import { setLocale } from "@/app/actions/locale";
import { ShieldCheck, RefreshCw, BookOpen, MapPin, Users, Award } from "lucide-react";

/** Marketing landing page — Server Component, no authentication required. */
export default async function LandingPage() {
  const t = await getT();
  return (
    <div className="min-h-screen bg-bg-base font-sans">
      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-bg-surface border-b border-border-light">
        <div className="max-w-6xl mx-auto px-gutter-lg flex items-center justify-between h-14">
          <span className="text-text-primary font-bold text-lg tracking-tight">Pathways</span>
          <nav className="flex items-center gap-6">
            <div className="flex items-center gap-1 border border-border rounded-btn overflow-hidden">
              <form action={setLocale.bind(null, "en", "/")}>
                <button type="submit" className="text-xs font-medium px-3 py-1.5 text-text-secondary hover:bg-bg-subtle transition-colors">EN</button>
              </form>
              <span className="text-border-light">|</span>
              <form action={setLocale.bind(null, "fr", "/")}>
                <button type="submit" className="text-xs font-medium px-3 py-1.5 text-text-secondary hover:bg-bg-subtle transition-colors">FR</button>
              </form>
            </div>
            <Link
              href="/auth/login"
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-gutter-lg pt-20 pb-16 text-center">
        <h1 className="text-4xl font-bold text-text-primary leading-tight max-w-2xl mx-auto mb-4">
          {t("landing_headline")}
        </h1>
        <p className="text-lg text-text-secondary max-w-xl mx-auto mb-10">
          {t("landing_subhead")}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
          <Link
            href="/auth/login?intent=signup"
            className="btn-primary px-8 py-3 text-base inline-block"
          >
            {t("landing_cta")}
          </Link>
          <Link
            href="/auth/login"
            className="text-sm text-text-secondary hover:text-text-primary underline underline-offset-2 transition-colors"
          >
            Already have an account? Sign in
          </Link>
        </div>

        {/* Trust chips */}
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { icon: ShieldCheck, text: t("landing_trust_1") },
            { icon: BookOpen, text: t("landing_trust_2") },
            { icon: RefreshCw, text: t("landing_trust_3") },
          ].map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-2 text-sm text-text-secondary bg-bg-surface border border-border-light rounded-pill px-4 py-2"
            >
              <Icon size={14} className="text-accent-500 shrink-0" />
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="bg-bg-surface border-y border-border-light py-16">
        <div className="max-w-6xl mx-auto px-gutter-lg">
          <p className="label-eyebrow text-center mb-2">How it works</p>
          <h2 className="text-2xl font-bold text-text-primary text-center mb-12">
            Three steps to your immigration roadmap
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Tell us about yourself",
                desc: "Answer a few questions by voice, chat, or form. Our AI guides the conversation — no jargon, no lawyers needed.",
                icon: Users,
              },
              {
                step: "02",
                title: "We analyse your profile",
                desc: "Our engine checks your eligibility against every active Canadian immigration pathway based on your exact situation.",
                icon: ShieldCheck,
              },
              {
                step: "03",
                title: "Get your pathway roadmap",
                desc: "Receive a prioritised list of pathways you qualify for, with a step-by-step checklist and document tracker.",
                icon: MapPin,
              },
            ].map(({ step, title, desc, icon: Icon }) => (
              <div key={step} className="card p-gutter flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="label-eyebrow text-accent-500">{step}</span>
                  <div className="w-9 h-9 rounded-icon bg-accent-50 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-accent-600" />
                  </div>
                </div>
                <div>
                  <h3 className="card-title mb-1">{title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Supported pathways ─────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-gutter-lg py-16">
        <p className="label-eyebrow text-center mb-2">Pathways we cover</p>
        <h2 className="text-2xl font-bold text-text-primary text-center mb-12">
          The main routes to Canadian permanent residence
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              emoji: "🍁",
              name: "Express Entry",
              desc: "Points-based federal system for skilled workers. Includes Federal Skilled Worker, Canadian Experience Class, and Federal Skilled Trades.",
            },
            {
              emoji: "🗺️",
              name: "Provincial Nominee Program",
              desc: "Each province nominates candidates who meet specific local labour market needs. Over 80 streams available across Canada.",
            },
            {
              emoji: "👨‍👩‍👧",
              name: "Family Sponsorship",
              desc: "Canadian citizens and permanent residents can sponsor eligible family members including spouses, children, and parents.",
            },
          ].map(({ emoji, name, desc }) => (
            <div key={name} className="card card-interactive p-gutter flex flex-col gap-3">
              <span className="text-3xl">{emoji}</span>
              <div>
                <h3 className="card-title mb-1">{name}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
              </div>
              <a
                href="#"
                className="mt-auto text-sm font-medium text-accent-600 hover:text-accent-700 flex items-center gap-1 transition-colors"
              >
                Learn more <span aria-hidden>→</span>
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <section className="bg-bg-surface border-y border-border-light py-12">
        <div className="max-w-6xl mx-auto px-gutter-lg text-center">
          <div className="flex flex-wrap justify-center gap-12 text-text-secondary">
            {[
              { stat: "71+", label: "Official IRCC sources indexed" },
              { stat: "3 min", label: "Average profile completion" },
              { stat: "80+", label: "PNP streams tracked" },
            ].map(({ stat, label }) => (
              <div key={label}>
                <p className="text-3xl font-extrabold text-text-primary">{stat}</p>
                <p className="text-sm mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA strip ──────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-gutter-lg py-20 text-center">
        <Award size={36} className="text-accent-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-text-primary mb-3">
          Ready to find your pathway?
        </h2>
        <p className="text-text-secondary mb-8 max-w-sm mx-auto">
          It takes about three minutes and you don&apos;t need to create an account to get started.
        </p>
        <Link
          href="/auth/login?intent=signup"
          className="btn-primary px-10 py-3 text-base inline-block"
        >
          {t("landing_cta")}
        </Link>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-border-light bg-bg-surface">
        <div className="max-w-6xl mx-auto px-gutter-lg py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text-tertiary">
          <p>© 2026 Pathways. General information only, not legal advice.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-text-secondary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-text-secondary transition-colors">Terms of Use</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
