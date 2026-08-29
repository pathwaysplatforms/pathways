import { requireAdmin } from "@/modules/auth/service";
import { listUsers } from "@/modules/account/adminService";
import { createRequestLogger } from "@/lib/logger";
import { redirect } from "next/navigation";
import { UserTableClient } from "./UserTableClient";

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

/** Admin user management table with pagination and search. */
export default async function AdminUsersPage({ searchParams: searchParamsPromise }: PageProps) {
  const searchParams = await searchParamsPromise;
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    redirect("/auth/login");
  }

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const search = searchParams.search ?? "";
  const correlationId = `admin-users-${admin.id}-${Date.now()}`;
  const log = createRequestLogger(correlationId);

  log.info({ action: "admin.users.page.start", adminId: admin.id, page, search });

  const result = await listUsers(page, search, log);

  log.info({ action: "admin.users.page.done", total: result.total });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 className="text-lg font-semibold text-text-primary" style={{ marginBottom: 4 }}>
          Users
        </h1>
        <p className="text-sm text-text-secondary">
          {result.total} user{result.total !== 1 ? "s" : ""} total
        </p>
      </div>

      <UserTableClient
        initialResult={result}
        currentSearch={search}
        currentAdminId={admin.id}
      />
    </div>
  );
}
