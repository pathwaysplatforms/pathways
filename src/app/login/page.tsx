import { redirect } from "next/navigation";

/** Clean /login route — redirects to the actual auth page. */
export default function LoginPage() {
  redirect("/auth/login");
}
