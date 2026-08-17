'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Route,
  Files,
  Map,
  TrendingUp,
  User,
  Settings,
  LogOut,
  Sparkles,
  Search,
  ArrowLeft,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ChatInput } from '@/components/ask/ChatInput';
import { MarkdownMessage } from '@/components/ask/MarkdownMessage';
import type { SubscriptionStatus } from '@/modules/account/types';

interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

interface TopNavProps {
  avatarInitials: string;
  firstName: string;
  subscriptionStatus?: SubscriptionStatus;
  /** The active plane index (0–4), or -1 when not in the plane. Defaults to -1. */
  activeIndex?: number;
  /** Called when a plane nav item is clicked. */
  onNavigate?: (index: number) => void;
  /** Called when Profile or Settings is selected from the avatar dropdown. */
  onOpenModal?: () => void;
  /** When true, renders a flat background instead of the glassmorphism style. */
  flat?: boolean;
}

interface NavItemDef {
  label: string;
  icon: LucideIcon;
  index: number;
}

const TIER_LABELS: Record<SubscriptionStatus, string> = {
  guest: 'Guest',
  free: 'Free',
  paid: 'Pro',
};

const navItems: NavItemDef[] = [
  { label: 'Dashboard',     icon: LayoutDashboard, index: 0 },
  { label: 'Applications',  icon: Route,           index: 1 },
  { label: 'Documents',     icon: Files,           index: 2 },
  { label: 'Pathways',      icon: Map,             index: 3 },
  { label: 'Draws Tracker', icon: TrendingUp,      index: 4 },
];

/** Horizontal top navigation bar — white, hairline border, Swiss typography. */
export function TopNav({
  avatarInitials,
  firstName,
  subscriptionStatus = 'free',
  activeIndex = -1,
  onNavigate = () => {},
  onOpenModal = () => {},
  flat = false,
}: TopNavProps) {
  const router = useRouter();
  const [tabsReady, setTabsReady] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [upgradeHovered, setUpgradeHovered] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSearchHovered, setAiSearchHovered] = useState(false);
  const [aiSearchFocused, setAiSearchFocused] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const aiMessagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setTabsReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Close dropdown on outside click.
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  // Close dropdown on Escape.
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [dropdownOpen]);

  // Close the AI assistant panel on Escape — returns straight to the underlying page.
  useEffect(() => {
    if (!aiOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAiOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [aiOpen]);

  useEffect(() => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, aiLoading]);

  // Submits a question to the reused /api/ask backend (same one AskPageClient
  // uses) and opens the panel if it isn't already. Called both from the topbar
  // bar's first submission and from follow-up messages typed inside the panel.
  async function handleAskSubmit(value: string) {
    if (!value || aiLoading) return;
    setAiOpen(true);
    setAiError(null);

    const userMessage: AiMessage = { id: crypto.randomUUID(), role: 'user', content: value };
    const newMessages = [...aiMessages, userMessage];
    setAiMessages(newMessages);
    setAiLoading(true);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: value,
          conversationHistory: aiMessages.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = (await response.json()) as { answer?: string; sources?: string[]; error?: { message: string } };
      if (!response.ok || data.error) {
        setAiError(data.error?.message ?? 'Something went wrong. Please try again.');
        setAiLoading(false);
        return;
      }
      setAiMessages([...newMessages, { id: crypto.randomUUID(), role: 'assistant', content: data.answer ?? '', sources: data.sources ?? [] }]);
    } catch {
      setAiError('Something went wrong. Please try again.');
    } finally {
      setAiLoading(false);
    }
  }

  function handleAiBarSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = aiQuery.trim();
    if (!trimmed) return;
    setAiQuery('');
    void handleAskSubmit(trimmed);
  }

  async function handleSignOut() {
    setSigningOut(true);
    setDropdownOpen(false);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  function handleModalOpen() {
    setDropdownOpen(false);
    onOpenModal();
  }

  function handleUpgrade() {
    setCheckoutError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/stripe/checkout', { method: 'POST' });
        if (res.status === 401) { router.push('/auth/login'); return; }
        const json = await res.json() as { url?: string; error?: { message: string } };
        if (json.url) {
          window.location.href = json.url;
        } else {
          setCheckoutError(json.error?.message ?? 'Something went wrong.');
        }
      } catch {
        setCheckoutError('Could not start checkout. Please try again.');
      }
    });
  }

  return (
    <>
    <nav
      className={`${flat ? 'h-14' : 'h-12'} flex items-center flex-shrink-0${flat ? '' : ' pw-topnav-glass px-8'}`}
      style={flat
        ? { position: 'relative', zIndex: 10, background: '#FFFFFF', paddingLeft: 20, paddingRight: 20, borderBottom: '1px solid var(--pw-rule)' }
        : undefined}
      aria-label="Main navigation"
    >
      {/* Wordmark — on the application page this no longer grows, so the nav
          buttons that follow sit to its immediate right instead of centering. */}
      <div className={flat ? 'flex items-center gap-2' : 'flex-1 flex items-center gap-2'} style={flat ? { flexShrink: 0 } : undefined}>
        <span
          className="text-pw-ink"
          style={{ fontFamily: 'var(--pw-font-display)', fontSize: 20, fontWeight: 600 }}
        >
          Pathways
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-pw-accent flex-shrink-0" aria-hidden="true" />
      </div>

      {/* Nav buttons */}
      <div className="flex items-center h-full" style={flat ? { marginLeft: 28 } : undefined}>
        {navItems.map(({ label, icon: Icon, index }) => {
          const isActive = activeIndex === index;
          const isHovered = hoveredIndex === index;

          const tabClass = [
            'pw-nav-tab',
            flat ? 'pw-nav-tab--flush' : '',
            'flex items-center gap-2 h-full',
            flat ? 'px-2.5' : 'px-4',
            isActive ? 'active' : '',
            !tabsReady ? 'no-transition' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={label}
              type="button"
              className={tabClass}
              onClick={() => onNavigate(index)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                fontSize: 14,
                fontWeight: 400,
                fontFamily: 'var(--pw-font-body)',
                color: (isActive || isHovered) ? 'var(--pw-ink)' : 'var(--pw-muted)',
                transition: 'color 90ms ease',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {!flat && <Icon size={14} />}
              {label}
            </button>
          );
        })}
      </div>

      {/* Account area — the ask-AI bar lives here too (application page only) so it
          sits truly right-aligned, flush against Upgrade/avatar rather than centered
          in its own half of the bar. */}
      <div ref={dropdownRef} className="flex-1 flex justify-end items-center gap-3" style={{ position: 'relative' }}>

        {/* Ask AI bar — application page only. Typing and pressing Enter is what
            opens the panel; clicking alone opens nothing. */}
        {flat && (
          <form
            onSubmit={handleAiBarSubmit}
            onMouseEnter={() => setAiSearchHovered(true)}
            onMouseLeave={() => setAiSearchHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: 240,
              flexShrink: 0,
              padding: '6px 14px',
              borderRadius: 9999,
              border: `1px solid rgba(0,0,0,${aiSearchFocused ? 0.85 : aiSearchHovered ? 0.75 : 0.55})`,
              background: aiSearchHovered || aiSearchFocused ? 'rgba(0,0,0,0.03)' : '#FAFAFB',
              transition: 'background 120ms ease, border-color 120ms ease',
            }}
          >
            <Search size={14} color={aiSearchFocused || aiSearchHovered ? 'var(--pw-ink)' : 'var(--pw-muted)'} style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onFocus={() => setAiSearchFocused(true)}
              onBlur={() => setAiSearchFocused(false)}
              placeholder="Ask AI anything…"
              aria-label="Ask AI anything"
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: 'var(--pw-font-body)',
                fontSize: 13,
                color: 'var(--pw-ink)',
                background: 'transparent',
                border: 'none',
                outline: 'none',
              }}
            />
          </form>
        )}

        {/* Upgrade link — hidden for paid users */}
        {subscriptionStatus !== 'paid' && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={isPending}
              onMouseEnter={() => setUpgradeHovered(true)}
              onMouseLeave={() => setUpgradeHovered(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 30,
                padding: '0 4px',
                border: 'none',
                background: 'none',
                color: upgradeHovered && !isPending ? '#1A56DB' : 'var(--pw-muted)',
                fontFamily: 'var(--pw-font-body)',
                fontSize: 13,
                fontWeight: 500,
                cursor: isPending ? 'default' : 'pointer',
                opacity: isPending ? 0.7 : 1,
                transition: 'color 120ms ease, opacity 150ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Sparkles size={12} style={{ opacity: 0.85, flexShrink: 0 }} />
              {isPending ? 'Redirecting…' : 'Upgrade to Pro'}
            </button>
            {checkoutError && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: '#fff',
                border: '1px solid rgba(208,0,12,0.2)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 11,
                fontFamily: 'var(--pw-font-body)',
                color: '#D0000C',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                zIndex: 200,
              }}>
                {checkoutError}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          aria-label="Account menu"
          aria-expanded={dropdownOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 9999,
          }}
        >
          <div
            className="flex items-center justify-center rounded-full bg-pw-ink text-white select-none flex-shrink-0"
            style={{ width: 34, height: 34, fontSize: 12, fontFamily: 'var(--pw-font-body)' }}
            aria-hidden="true"
          >
            {avatarInitials}
          </div>
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              minWidth: 180,
              backgroundColor: '#fff',
              border: '1px solid var(--pw-border)',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
              overflow: 'hidden',
              zIndex: 100,
            }}
          >
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--pw-border)' }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--pw-ink)', fontFamily: 'var(--pw-font-body)' }}>
                {firstName}
              </p>
              <p style={{ fontSize: 11, color: 'var(--pw-muted)', fontFamily: 'var(--pw-font-body)' }}>
                {TIER_LABELS[subscriptionStatus]} plan
              </p>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={handleModalOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 14px',
                fontSize: 14,
                fontFamily: 'var(--pw-font-body)',
                color: 'var(--pw-ink)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <User size={14} color="var(--pw-muted)" />
              Profile
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleModalOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 14px',
                fontSize: 14,
                fontFamily: 'var(--pw-font-body)',
                color: 'var(--pw-ink)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <Settings size={14} color="var(--pw-muted)" />
              Account settings
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 14px',
                fontSize: 14,
                fontFamily: 'var(--pw-font-body)',
                color: signingOut ? 'var(--pw-muted)' : 'var(--pw-ink)',
                background: 'none',
                border: 'none',
                cursor: signingOut ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                borderTop: '1px solid var(--pw-border)',
              }}
              onMouseEnter={(e) => { if (!signingOut) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <LogOut size={14} color="var(--pw-muted)" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}
      </div>
    </nav>

    {/* AI assistant — right-side panel reusing the platform's Ask Pathways chat
        (ChatInput + MarkdownMessage, POSTing to /api/ask). Opens only once the
        user submits a question from the topbar bar. The Back button and Escape
        both just close the panel, dropping the user back exactly where they
        were since the underlying page never unmounts. */}
    {flat && aiOpen && (
      <>
        <div
          role="presentation"
          onClick={() => setAiOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 299, background: 'rgba(13,13,13,0.24)' }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI Assistant"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 420,
            maxWidth: '100%',
            zIndex: 300,
            background: '#FFFFFF',
            borderLeft: '1px solid var(--pw-rule)',
            boxShadow: '-12px 0 40px rgba(0,0,0,0.14)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <style>{`
            @keyframes pwTopnavDotPulse { 0%,80%,100% { opacity:0.2 } 40% { opacity:1 } }
            .pw-topnav-ai-dot-1 { animation: pwTopnavDotPulse 1.2s ease-in-out infinite 0ms; }
            .pw-topnav-ai-dot-2 { animation: pwTopnavDotPulse 1.2s ease-in-out infinite 150ms; }
            .pw-topnav-ai-dot-3 { animation: pwTopnavDotPulse 1.2s ease-in-out infinite 300ms; }
            .pw-source-link { font-family: var(--pw-font-body); font-size: 11px; color: #6B7280; display: block; margin-bottom: 2px; text-decoration: none; }
            .pw-source-link:hover { color: #1A56DB; text-decoration: underline; }
            .pw-md-link { color: #1A56DB; text-decoration: underline; text-underline-offset: 2px; }
            .pw-md-link:hover { color: #1345B5; }
            .pw-md-bold { font-weight: 600; color: #0F0F0F; }
            .pw-md-p { font-family: var(--pw-font-body); font-size: 14px; line-height: 1.75; color: #374151; margin-bottom: 12px; }
            .pw-md-p:last-child { margin-bottom: 0; }
            .pw-md-heading { font-family: var(--pw-font-body); font-size: 14px; line-height: 1.75; color: #0F0F0F; font-weight: 600; margin-bottom: 4px; }
            .pw-md-ul, .pw-md-ol { margin-left: 16px; margin-top: 8px; margin-bottom: 8px; padding-left: 0; }
            .pw-md-ul { list-style-type: disc; }
            .pw-md-ol { list-style-type: decimal; }
            .pw-md-li { font-family: var(--pw-font-body); font-size: 14px; line-height: 1.75; color: #374151; margin-bottom: 4px; }
          `}</style>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--pw-rule)', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setAiOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 9999,
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--pw-font-body)', fontSize: 13, fontWeight: 500,
                color: 'var(--pw-muted)', flexShrink: 0,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Sparkles size={14} color="var(--pw-accent)" />
              <span style={{ fontFamily: 'var(--pw-font-display)', fontSize: 15, fontWeight: 600, color: 'var(--pw-ink)' }}>
                AI Assistant
              </span>
            </div>
            <div style={{ width: 62, flexShrink: 0 }} aria-hidden="true" />
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: aiMessages.length === 0 && !aiLoading ? 0 : '20px 20px 0' }}>
            {aiMessages.length === 0 && !aiLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '40px 28px' }}>
                <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 13, color: 'var(--pw-muted)', margin: 0, lineHeight: 1.6 }}>
                  Ask about documents, timelines, eligibility, or any step in your application.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 20 }}>
                {aiMessages.map((msg) => msg.role === 'user' ? (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
                    <div style={{ maxWidth: '85%', borderLeft: '2px solid #1A56DB', padding: '0 0 0 12px' }}>
                      <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#0F0F0F', margin: 0, wordBreak: 'break-word' }}>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 24 }}>
                    <div style={{ maxWidth: '95%' }}>
                      <div style={{ wordBreak: 'break-word', marginBottom: (msg.sources?.length ?? 0) > 0 ? 8 : 0 }}>
                        <MarkdownMessage content={msg.content} />
                      </div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div>
                          <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', margin: '0 0 6px' }}>
                            Sources
                          </p>
                          {Array.from(new Set(msg.sources)).map((src) => (
                            <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="pw-source-link" title={src}>
                              {src}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {aiLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} aria-label="Thinking…">
                      <span className="pw-topnav-ai-dot-1" style={{ width: 4, height: 4, borderRadius: '50%', background: '#D1D5DB', display: 'inline-block' }} />
                      <span className="pw-topnav-ai-dot-2" style={{ width: 4, height: 4, borderRadius: '50%', background: '#D1D5DB', display: 'inline-block' }} />
                      <span className="pw-topnav-ai-dot-3" style={{ width: 4, height: 4, borderRadius: '50%', background: '#D1D5DB', display: 'inline-block' }} />
                    </div>
                  </div>
                )}

                {aiError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }} role="alert">
                    <AlertCircle size={12} style={{ color: '#DC2626', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--pw-font-body)', fontSize: 12, color: '#DC2626' }}>{aiError}</span>
                  </div>
                )}

                <div ref={aiMessagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ flexShrink: 0, padding: '12px 16px 16px' }}>
            <ChatInput onSubmit={(v) => void handleAskSubmit(v)} isLoading={aiLoading} placeholder="Ask a follow-up…" />
          </div>
        </div>
      </>
    )}
    </>
  );
}
