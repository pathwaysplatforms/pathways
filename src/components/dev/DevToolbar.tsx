"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { MOCK_IMMIGRATION_PROFILE } from "./mockProfile";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type SessionInfo = {
  userId: string | null;
  email: string | null;
  expiresAt: number | null;
  status: "AUTHENTICATED" | "ANONYMOUS" | "NO_SESSION";
};

type RouteGroup = {
  label: string;
  routes: { path: string; label: string }[];
};

const ROUTE_GROUPS: RouteGroup[] = [
  {
    label: "AUTH",
    routes: [
      { path: "/auth/login", label: "/auth/login" },
      { path: "/auth/demo/callback", label: "/auth/demo/callback" },
    ],
  },
  {
    label: "ONBOARDING",
    routes: [
      { path: "/onboarding", label: "/onboarding" },
      { path: "/onboarding/voice", label: "/onboarding/voice" },
      { path: "/onboarding/review", label: "/onboarding/review" },
      { path: "/onboarding/matches", label: "/onboarding/matches" },
    ],
  },
  {
    label: "MAIN APP",
    routes: [
      { path: "/", label: "/" },
      { path: "/dashboard", label: "/dashboard" },
      { path: "/profile", label: "/profile" },
      { path: "/pathway", label: "/pathway" },
      { path: "/pathways", label: "/pathways" },
      { path: "/documents", label: "/documents" },
      { path: "/draws", label: "/draws" },
      { path: "/crs", label: "/crs" },
      { path: "/applications", label: "/applications" },
    ],
  },
  {
    label: "PATHWAYS",
    routes: [
      { path: "/pathways/results", label: "/pathways/results" },
      { path: "/pathways/express-entry", label: "/pathways/express-entry" },
      { path: "/pathways/pnp-ontario", label: "/pathways/pnp-ontario" },
      { path: "/pathways/family-sponsorship", label: "/pathways/family-sponsorship" },
    ],
  },
];

const STORAGE_KEY = "pathways_devtool_open";

/** Formats seconds-since-epoch as a relative expiry string. */
function formatExpiry(expiresAt: number | null): string {
  if (expiresAt === null) return "—";
  const diffMs = expiresAt * 1000 - Date.now();
  if (diffMs <= 0) return "EXPIRED";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `expires in ${mins}min`;
  const hours = Math.floor(mins / 60);
  return `expires in ${hours}h ${mins % 60}min`;
}

/** Returns the first 3 keys of an object as a compact JSON preview. */
function compactJson(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val !== "object" || Array.isArray(val)) return JSON.stringify(val);
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj).slice(0, 3);
  const preview: Record<string, unknown> = {};
  for (const k of keys) preview[k] = obj[k];
  return keys.length < Object.keys(obj).length
    ? JSON.stringify(preview).slice(0, -1) + ', "...": "..."}'
    : JSON.stringify(preview);
}

export default function DevToolbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState<boolean>(false);
  const [session, setSession] = useState<SessionInfo>({
    userId: null,
    email: null,
    expiresAt: null,
    status: "NO_SESSION",
  });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [jsonExpanded, setJsonExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"nav" | "session" | "profile">("nav");
  const [isSkipping, setIsSkipping] = useState<boolean>(false);
  const [skipDone, setSkipDone] = useState<boolean>(false);

  const supabase = createSupabaseBrowserClient();

  // Persist open state
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setOpen(true);
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // Fetch session + profile
  const refreshSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    if (!s) {
      setSession({ userId: null, email: null, expiresAt: null, status: "NO_SESSION" });
      setProfile(null);
      return;
    }
    setSession({
      userId: s.user.id,
      email: s.user.email ?? null,
      expiresAt: s.expires_at ?? null,
      status: "AUTHENTICATED",
    });
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", s.user.id)
      .single();
    setProfile(profileData ?? null);
  }, [supabase]);

  useEffect(() => {
    void refreshSession();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshSession();
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshSession, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleCopyId = async () => {
    if (!session.userId) return;
    await navigator.clipboard.writeText(session.userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSkipOnboarding = async () => {
    console.log("[DevToolbar] handleSkipOnboarding fired");
    setIsSkipping(true);
    setSkipDone(false);
    try {
      const client = createSupabaseBrowserClient();

      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError) throw new Error(`Auth error: ${authError.message}`);
      if (!user) throw new Error("No authenticated user — log in first");

      // Mirror finalizeVoiceSession's write pattern: full profile blob in voice_session_data
      // (JSONB), plus the scalar status columns. All five columns confirmed in schema.
      // PostgrestVersion "14.5" type forces the DevUpdateBuilder cast — same reason
      // as the server-side services that cast to SupabaseClient without generics.
      type DevUpdateBuilder = {
        update(values: Record<string, unknown>): {
          eq(column: string, value: string): Promise<{ error: { message: string } | null }>;
        };
      };
      const table = client.from("profiles") as unknown as DevUpdateBuilder;
      const { error: updateError } = await table
        .update({
          voice_session_data: MOCK_IMMIGRATION_PROFILE,
          onboarding_status: "complete",
          onboarding_step: "voice_complete",
          onboarding_method: "voice",
          updated_at: new Date().toISOString(),
        })
        .eq("auth_user_id", user.id);

      if (updateError) throw new Error(`Profile update failed: ${updateError.message}`);

      setSkipDone(true);
      setTimeout(() => {
        setSkipDone(false);
        router.push("/dashboard");
      }, 800);
    } catch (err) {
      console.error("[DevToolbar] Skip onboarding failed:", err);
      alert(`[DevToolbar] Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSkipping(false);
    }
  };

  const statusColor =
    session.status === "AUTHENTICATED"
      ? "#00ff88"
      : session.status === "ANONYMOUS"
        ? "#ff9900"
        : "#ff4444";

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 9999,
        fontFamily: "monospace",
      }}
    >
      {/* Expanded panel */}
      {open && (
        <div
          style={{
            width: "420px",
            maxHeight: "80vh",
            background: "#1a1a1a",
            border: "2px solid #FFDD00",
            borderRadius: "8px",
            marginBottom: "8px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Panel header */}
          <div
            style={{
              background: "#FFDD00",
              padding: "6px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <span style={{ fontWeight: "bold", fontSize: "11px", color: "#000" }}>
              ⚠ PATHWAYS DEV TOOLS ⚠
            </span>
            <span style={{ fontSize: "10px", color: "#000", opacity: 0.7 }}>
              {pathname}
            </span>
          </div>

          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #333",
              flexShrink: 0,
            }}
          >
            {(["nav", "session", "profile"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "6px",
                  background: activeTab === tab ? "#2a2a2a" : "transparent",
                  border: "none",
                  borderBottom: activeTab === tab ? "2px solid #FFDD00" : "2px solid transparent",
                  color: activeTab === tab ? "#FFDD00" : "#888",
                  fontSize: "10px",
                  cursor: "pointer",
                  fontFamily: "monospace",
                  textTransform: "uppercase",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ padding: "12px", overflowY: "auto" }}>
            {/* NAV TAB */}
            {activeTab === "nav" && (
              <div>
                {ROUTE_GROUPS.map((group) => (
                  <div key={group.label} style={{ marginBottom: "12px" }}>
                    <div
                      style={{
                        fontSize: "9px",
                        color: "#FFDD00",
                        marginBottom: "4px",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {group.label}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {group.routes.map((r) => {
                        const isActive = pathname === r.path;
                        return (
                          <button
                            key={r.path}
                            onClick={() => router.push(r.path)}
                            style={{
                              padding: "3px 8px",
                              fontSize: "10px",
                              background: isActive ? "#FFDD00" : "#2a2a2a",
                              color: isActive ? "#000" : "#ccc",
                              border: isActive ? "1px solid #FFDD00" : "1px solid #444",
                              borderRadius: "3px",
                              cursor: "pointer",
                              fontFamily: "monospace",
                              fontWeight: isActive ? "bold" : "normal",
                            }}
                          >
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SESSION TAB */}
            {activeTab === "session" && (
              <div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                  <tbody>
                    <tr>
                      <td style={{ color: "#888", padding: "4px 0", paddingRight: "12px" }}>
                        status
                      </td>
                      <td style={{ color: statusColor, fontWeight: "bold" }}>
                        {session.status}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: "#888", padding: "4px 0", paddingRight: "12px" }}>
                        user.id
                      </td>
                      <td style={{ color: "#eee" }}>
                        {session.userId ? session.userId.slice(0, 8) + "…" : "—"}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: "#888", padding: "4px 0", paddingRight: "12px" }}>
                        email
                      </td>
                      <td style={{ color: "#eee" }}>{session.email ?? "—"}</td>
                    </tr>
                    <tr>
                      <td style={{ color: "#888", padding: "4px 0", paddingRight: "12px" }}>
                        expires
                      </td>
                      <td style={{ color: "#eee" }}>{formatExpiry(session.expiresAt)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === "profile" && (
              <div>
                {profile === null ? (
                  <div style={{ color: "#888", fontSize: "11px" }}>
                    {session.status === "AUTHENTICATED" ? "Loading profile…" : "Not authenticated"}
                  </div>
                ) : (
                  <div>
                    <table
                      style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}
                    >
                      <tbody>
                        <tr>
                          <td
                            style={{ color: "#888", padding: "4px 0", paddingRight: "12px" }}
                          >
                            onboarding_status
                          </td>
                          <td
                            style={{
                              color:
                                profile.onboarding_status === "complete" ? "#00ff88" : "#ff9900",
                            }}
                          >
                            {profile.onboarding_status}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{ color: "#888", padding: "4px 0", paddingRight: "12px" }}
                          >
                            onboarding_step
                          </td>
                          <td style={{ color: "#eee" }}>{profile.onboarding_step ?? "—"}</td>
                        </tr>
                        <tr>
                          <td
                            style={{ color: "#888", padding: "4px 0", paddingRight: "12px" }}
                          >
                            is_admin
                          </td>
                          <td
                            style={{ color: profile.is_admin ? "#00ff88" : "#888" }}
                          >
                            {String(profile.is_admin)}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{ color: "#888", padding: "4px 0", paddingRight: "12px" }}
                          >
                            nationality
                          </td>
                          <td style={{ color: "#eee" }}>{profile.nationality ?? "—"}</td>
                        </tr>
                        <tr>
                          <td
                            style={{ color: "#888", padding: "4px 0", paddingRight: "12px" }}
                          >
                            created_at
                          </td>
                          <td style={{ color: "#eee" }}>
                            {new Date(profile.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* pathway_input_json expandable */}
                    <div style={{ marginTop: "10px" }}>
                      <button
                        onClick={() => setJsonExpanded((v) => !v)}
                        style={{
                          fontSize: "9px",
                          color: "#FFDD00",
                          background: "transparent",
                          border: "1px solid #444",
                          borderRadius: "3px",
                          padding: "2px 6px",
                          cursor: "pointer",
                          fontFamily: "monospace",
                          marginBottom: "4px",
                        }}
                      >
                        pathway_input_json {jsonExpanded ? "▲ collapse" : "▼ expand"}
                      </button>
                      {jsonExpanded ? (
                        <pre
                          style={{
                            background: "#111",
                            border: "1px solid #333",
                            borderRadius: "3px",
                            padding: "8px",
                            fontSize: "9px",
                            color: "#ccc",
                            overflowX: "auto",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            maxHeight: "200px",
                            overflowY: "auto",
                          }}
                        >
                          {JSON.stringify(profile.pathway_input_json, null, 2)}
                        </pre>
                      ) : (
                        <div
                          style={{
                            fontSize: "9px",
                            color: "#888",
                            background: "#111",
                            border: "1px solid #333",
                            borderRadius: "3px",
                            padding: "4px 8px",
                          }}
                        >
                          {compactJson(profile.pathway_input_json)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions — always visible */}
            <div
              style={{
                marginTop: "12px",
                paddingTop: "10px",
                borderTop: "1px solid #333",
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
              }}
            >
              <button
                onClick={handleSkipOnboarding}
                disabled={isSkipping}
                style={{
                  ...actionBtnStyle,
                  background: isSkipping ? "#444" : skipDone ? "#00FF88" : "#00FF88",
                  color: "#000",
                  fontWeight: "bold",
                  opacity: isSkipping ? 0.7 : 1,
                  cursor: isSkipping ? "not-allowed" : "pointer",
                }}
              >
                {isSkipping ? "Filling profile…" : skipDone ? "✅ Done!" : "⚡ Skip Onboarding"}
              </button>
              <button
                onClick={handleSignOut}
                style={actionBtnStyle}
              >
                [Clear Session]
              </button>
              <button
                onClick={handleCopyId}
                style={actionBtnStyle}
              >
                {copied ? "Copied!" : "[Copy User ID]"}
              </button>
              <button
                onClick={() => router.push("/onboarding/voice")}
                style={actionBtnStyle}
              >
                [Force Onboarding]
              </button>
              <button
                onClick={() => window.location.reload()}
                style={actionBtnStyle}
              >
                [Reload]
              </button>
              <button
                onClick={refreshSession}
                style={actionBtnStyle}
              >
                [Refresh State]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle pill button */}
      <button
        onClick={toggleOpen}
        style={{
          background: "#FFDD00",
          color: "#000",
          border: "none",
          borderRadius: "999px",
          padding: "8px 16px",
          cursor: "pointer",
          fontFamily: "monospace",
          fontSize: "12px",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          transition: "transform 0.1s ease",
          transform: "scale(1)",
          marginLeft: "auto",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        }}
      >
        <span
          style={{
            background: "#ff3333",
            color: "#fff",
            fontSize: "9px",
            padding: "1px 4px",
            borderRadius: "3px",
            animation: "pulse 1.5s infinite",
          }}
          className="animate-pulse"
        >
          [DEV]
        </span>
        {open ? "▼ close" : "▲ devtools"}
      </button>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: "10px",
  background: "#2a2a2a",
  color: "#FFDD00",
  border: "1px solid #444",
  borderRadius: "3px",
  cursor: "pointer",
  fontFamily: "monospace",
};
