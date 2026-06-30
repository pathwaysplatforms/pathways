import { redirect } from "next/navigation";
import { requireAuth } from "@/modules/auth/service";
import { getAccountProfile } from "@/modules/account/service";
import { createRequestLogger } from "@/lib/logger";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccountProfileSection } from "@/components/account/AccountProfileSection";
import { AccountSubscriptionSection } from "@/components/account/AccountSubscriptionSection";
import { AccountSecuritySection } from "@/components/account/AccountSecuritySection";
import { AccountDangerZone } from "@/components/account/AccountDangerZone";

/** Account settings page — five collapsible sections covering all user account management. */
export default async function AccountPage() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    redirect("/auth/login");
  }

  const correlationId = `account-${user.id}-${Date.now()}`;
  const log = createRequestLogger(correlationId);
  log.info({ action: "account.page.start", userId: user.id });

  const profile = await getAccountProfile(user.id, log);
  log.info({ action: "account.page.done", userId: user.id });

  const initials = (profile.full_name ?? profile.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const firstName = profile.full_name?.split(" ")[0] ?? profile.email?.split("@")[0] ?? "Account";

  return (
    <DashboardShell
      avatarInitials={initials}
      firstName={firstName}
      subscriptionStatus={profile.subscription_status}
    >
      <div
        className="flex-1 overflow-y-auto"
        style={{ padding: "32px 28px 48px" }}
      >
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          {/* Page header */}
          <div style={{ marginBottom: 32 }}>
            <h1
              style={{
                fontFamily: "var(--pw-font-display)",
                fontSize: "clamp(1.5rem, 3vw, 2rem)",
                fontWeight: 400,
                color: "var(--pw-ink)",
                letterSpacing: "-0.02em",
                marginBottom: 6,
              }}
            >
              Account settings
            </h1>
            <p style={{ fontSize: 14, color: "var(--pw-muted)", fontFamily: "var(--pw-font-body)" }}>
              Manage your profile, subscription, and security preferences.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Section A: Profile */}
            <AccountProfileSection profile={profile} />

            {/* Section C: Subscription */}
            <AccountSubscriptionSection
              subscriptionStatus={profile.subscription_status}
              createdAt={profile.created_at}
            />

            {/* Section D: Security */}
            <AccountSecuritySection email={profile.email} />

            {/* Section E: Danger Zone */}
            <AccountDangerZone />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
