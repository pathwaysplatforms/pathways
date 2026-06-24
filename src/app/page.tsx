import { redirect } from "next/navigation";
import { getSession } from "@/modules/auth/service";

/** Root — send authenticated users to the dashboard, everyone else to sign-in. */
export default async function RootPage() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }
  redirect("/auth/login");
}
