import { TopNav } from "@/components/layout/TopNav";

/** Layout wrapper for all /dashboard routes — adds the sticky top nav. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
