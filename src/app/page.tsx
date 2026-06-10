import Link from "next/link";
import { getT } from "@/lib/i18n";
import { setLocale } from "@/app/actions/locale";
import { ShieldCheck, RefreshCw, BookOpen, MapPin, Users, Award } from "lucide-react";
import { GlobeCanvas } from "@/components/GlobeCanvas";
import { HalftoneTexture } from "@/components/HalftoneTexture";
import { CircleGuide } from "@/components/CircleGuide";

/** Marketing landing page — Swiss Particle Brutalism aesthetic. */
export default async function LandingPage() {
  const t = await getT();

  return (
    <div className="min-h-screen bg-pw-bg font-body text-pw-ink">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-pw-bg border-b border-black/[0.08]">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
          <span
            className="text-pw-ink text-xl"
            style={{ fontFamily: "var(--pw-font-display)" }}
          >
            Pathways
          </span>
          <nav className="flex items-center gap-6">
            <div className="flex items-center gap-1 border border-black/[0.08] rounded-full overflow-hidden">
              <form action={setLocale.bind(null, "en", "/")}>
                <button
                  type="submit"
                  className="text-xs font-body px-3 py-1.5 text-pw-muted hover:text-pw-ink transition-colors duration-150"
                >
                  EN
                </button>
              </form>
              <span className="text-black/10">|</span>
              <form action={setLocale.bind(null, "fr", "/")}>
                <button
                  type="submit"
                  className="text-xs font-body px-3 py-1.5 text-pw-muted hover:text-pw-ink transition-colors duration-150"
                >
                  FR
                </button>
              </form>
            </div>
            <Link
              href="/auth/login"
              className="text-sm font-body text-pw-muted hover:text-pw-ink transition-colors duration-150"
            >
              Sign in
            </Link>
            <Link
              href="/auth/login?intent=signup"
              className="text-sm font-body px-5 py-2 rounded-full bg-pw-ink text-white hover:bg-pw-accent transition-colors duration-150"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative min-h-[calc(100vh-3.5rem)] flex items-center overflow-hidden bg-pw-bg">
        <HalftoneTexture />

        <div className="relative z-10 max-w-6xl mx-auto px-6 w-full py-20 md:py-0">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">

            {/* Left — headline + CTA */}
            <div>
              <p className="pw-eyebrow mb-6">Immigration guidance</p>
              <h1
                className="text-4xl md:text-6xl leading-tight text-pw-ink mb-6"
                style={{ fontFamily: "var(--pw-font-display)", fontWeight: 400 }}
              >
                Navigate your path forward.
              </h1>
              <p className="text-lg text-pw-muted leading-relaxed mb-10 max-w-md">
                AI-powered immigration guidance for every country, every situation.
              </p>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <Link
                  href="/auth/login?intent=signup"
                  className="px-8 py-3 rounded-full bg-pw-ink text-white text-sm font-body hover:bg-pw-accent transition-colors duration-150 inline-block"
                >
                  {t("landing_cta")}
                </Link>
                <Link
                  href="/auth/login"
                  className="text-sm text-pw-muted hover:text-pw-ink underline underline-offset-4 transition-colors duration-150 self-center"
                >
                  Already have an account?
                </Link>
              </div>
            </div>

            {/* Right — globe + circle guide */}
            <div className="relative flex justify-center items-center">
              <CircleGuide
                cx={230}
                cy={230}
                r={220}
                className="absolute w-[460px] h-[460px] opacity-80"
              />
              <GlobeCanvas />
            </div>
          </div>
        </div>
      </section>

      <hr className="pw-rule" />

      {/* ── Trust chips strip ──────────────────────────────────────────── */}
      <section className="py-8 bg-pw-surface">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap justify-center gap-6">
            {[
              { icon: ShieldCheck, text: t("landing_trust_1") },
              { icon: BookOpen,    text: t("landing_trust_2") },
              { icon: RefreshCw,  text: t("landing_trust_3") },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-2 text-sm text-pw-muted"
              >
                <Icon size={14} className="text-pw-accent shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="pw-rule" />

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="py-20 bg-pw-bg">
        <div className="max-w-6xl mx-auto px-6">
          <p className="pw-eyebrow text-center mb-3">How it works</p>
          <h2
            className="text-3xl md:text-4xl text-pw-ink text-center mb-16 leading-tight"
            style={{ fontFamily: "var(--pw-font-display)", fontWeight: 400 }}
          >
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
              <div key={step} className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="pw-eyebrow text-pw-accent">{step}</span>
                  <div className="w-8 h-8 rounded-full border border-black/[0.08] flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-pw-muted" />
                  </div>
                </div>
                <div>
                  <h3
                    className="text-lg text-pw-ink mb-2 leading-snug"
                    style={{ fontFamily: "var(--pw-font-display)", fontWeight: 400 }}
                  >
                    {title}
                  </h3>
                  <p className="text-sm text-pw-muted leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="pw-rule" />

      {/* ── Supported pathways ─────────────────────────────────────────── */}
      <section className="py-20 bg-pw-bg">
        <div className="max-w-6xl mx-auto px-6">
          <p className="pw-eyebrow text-center mb-3">Pathways we cover</p>
          <h2
            className="text-3xl md:text-4xl text-pw-ink text-center mb-16 leading-tight"
            style={{ fontFamily: "var(--pw-font-display)", fontWeight: 400 }}
          >
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
              <div
                key={name}
                className="pw-card p-6 flex flex-col gap-4 hover:border-black/20 transition-colors duration-150 cursor-default"
              >
                <span className="text-3xl" role="img">{emoji}</span>
                <div>
                  <h3
                    className="text-lg text-pw-ink mb-2 leading-snug"
                    style={{ fontFamily: "var(--pw-font-display)", fontWeight: 400 }}
                  >
                    {name}
                  </h3>
                  <p className="text-sm text-pw-muted leading-relaxed">{desc}</p>
                </div>
                <a
                  href="#"
                  className="mt-auto text-sm text-pw-muted hover:text-pw-ink transition-colors duration-150"
                >
                  Learn more →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="pw-rule" />

      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <section className="py-16 bg-pw-surface">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap justify-center gap-16">
            {[
              { stat: "71+",  label: "Official IRCC sources indexed" },
              { stat: "3 min", label: "Average profile completion"  },
              { stat: "80+",  label: "PNP streams tracked"          },
            ].map(({ stat, label }) => (
              <div key={label} className="text-center">
                <p
                  className="text-4xl md:text-5xl text-pw-ink mb-1"
                  style={{ fontFamily: "var(--pw-font-display)", fontWeight: 400 }}
                >
                  {stat}
                </p>
                <p className="text-sm text-pw-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="pw-rule" />

      {/* ── CTA strip ──────────────────────────────────────────────────── */}
      <section className="py-20 bg-pw-bg text-center">
        <div className="max-w-6xl mx-auto px-6">
          <Award size={32} className="text-pw-muted mx-auto mb-6" />
          <h2
            className="text-3xl md:text-4xl text-pw-ink mb-4 leading-tight"
            style={{ fontFamily: "var(--pw-font-display)", fontWeight: 400 }}
          >
            Ready to find your pathway?
          </h2>
          <p className="text-pw-muted mb-10 max-w-sm mx-auto leading-relaxed">
            It takes about three minutes and you don&apos;t need to create an account to get started.
          </p>
          <Link
            href="/auth/login?intent=signup"
            className="px-10 py-3 rounded-full bg-pw-ink text-white text-sm font-body hover:bg-pw-accent transition-colors duration-150 inline-block"
          >
            {t("landing_cta")}
          </Link>
        </div>
      </section>

      <hr className="pw-rule" />

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="bg-pw-bg">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-pw-muted">
          <p>© 2026 Pathways. General information only, not legal advice.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-pw-ink transition-colors duration-150">Privacy Policy</a>
            <a href="#" className="hover:text-pw-ink transition-colors duration-150">Terms of Use</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
