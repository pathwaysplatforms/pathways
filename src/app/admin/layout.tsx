import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/modules/auth/service";

/** Guard: redirects unauthenticated users and non-admins away from /admin. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-bg-subtle">
      <header className="bg-bg-surface border-b border-border sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-gutter-lg flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-text-primary">Pathways Admin</span>
            <nav className="flex items-center gap-4 text-sm text-text-secondary">
              <Link href="/admin/blog" className="hover:text-text-primary transition-colors duration-fast">
                Blog
              </Link>
              <Link href="/admin/users" className="hover:text-text-primary transition-colors duration-fast">
                Users
              </Link>
              <Link href="/admin/pathways" className="hover:text-text-primary transition-colors duration-fast">
                Pathways
              </Link>
            </nav>
          </div>
          <Link href="/dashboard" className="text-xs text-text-tertiary hover:text-text-secondary transition-colors duration-fast">
            ← Back to app
          </Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-gutter-lg py-10">
        {children}
      </main>
    </div>
  );
}
