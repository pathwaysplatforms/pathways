"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type Locale = "en" | "fr";

/** Set the locale preference cookie and redirect back to the given path. */
export async function setLocale(locale: Locale, redirectPath = "/"): Promise<never> {
  (await cookies()).set("pathways_locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false, // must be readable by client JS for useT()
  });
  redirect(redirectPath);
}
