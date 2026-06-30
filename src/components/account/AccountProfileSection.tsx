"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateProfileAction } from "@/app/account/actions";
import type { AccountProfile } from "@/modules/account/types";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "zh", label: "Chinese" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
];

interface Props {
  profile: AccountProfile;
}

/** Section A: editable display name, language, phone, and country. */
export function AccountProfileSection({ profile }: Props) {
  const [state, action] = useFormState(updateProfileAction, {});

  return (
    <section className="card" style={{ padding: 24 }}>
      <h2
        style={{
          fontFamily: "var(--pw-font-body)",
          fontSize: 15,
          fontWeight: 500,
          color: "var(--pw-ink)",
          marginBottom: 20,
        }}
      >
        Profile
      </h2>

      <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Full name" name="full_name" defaultValue={profile.full_name ?? ""} />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            htmlFor="preferred_language"
            style={{ fontSize: 13, fontWeight: 500, color: "var(--pw-ink)", fontFamily: "var(--pw-font-body)" }}
          >
            Preferred language
          </label>
          <select
            id="preferred_language"
            name="preferred_language"
            defaultValue={profile.preferred_language}
            style={{
              width: "100%",
              padding: "9px 12px",
              fontSize: 14,
              fontFamily: "var(--pw-font-body)",
              border: "1px solid var(--pw-border)",
              borderRadius: 8,
              backgroundColor: "#fff",
              color: "var(--pw-ink)",
              outline: "none",
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        <Field
          label="Phone (optional)"
          name="phone"
          type="tel"
          defaultValue={profile.phone ?? ""}
          placeholder="+16135551234"
        />

        <Field
          label="Nationality"
          name="nationality"
          defaultValue={profile.nationality ?? ""}
        />

        <Field
          label="Country of residence"
          name="country_of_residence"
          defaultValue={profile.country_of_residence ?? ""}
        />

        {state.error && (
          <p style={{ fontSize: 13, color: "#dc2626", fontFamily: "var(--pw-font-body)" }}>
            {state.error.message}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <SubmitButton />
        </div>
      </form>
    </section>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary"
      style={{ opacity: pending ? 0.6 : 1, cursor: pending ? "not-allowed" : "pointer" }}
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={name}
        style={{ fontSize: 13, fontWeight: 500, color: "var(--pw-ink)", fontFamily: "var(--pw-font-body)" }}
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "9px 12px",
          fontSize: 14,
          fontFamily: "var(--pw-font-body)",
          border: "1px solid var(--pw-border)",
          borderRadius: 8,
          color: "var(--pw-ink)",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
