import { cookies } from "next/headers";

export type Locale = "en" | "fr";

const strings = {
  en: {
    landing_headline: "Navigate your Canadian immigration journey with confidence",
    landing_subhead: "AI-powered guidance personalized to your exact profile",
    landing_cta: "Get started — it's free",
    landing_trust_1: "Based on official IRCC sources",
    landing_trust_2: "No account needed to explore",
    landing_trust_3: "Updated with every IRCC policy change",

    auth_title: "Welcome to Pathways",
    auth_subtitle: "Enter your email and we'll send you a secure sign-in link",
    auth_cta: "Send me a sign-in link",
    auth_magic_link_sent: "Check your inbox — your sign-in link is on its way",
    auth_error_expired: "That link has expired. Request a new one below.",
    auth_error_invalid: "Invalid sign-in link. Please try again.",
    auth_error_generic: "Something went wrong. Please try again.",

    onboarding_headline: "Let's find your best immigration pathway",
    onboarding_subhead:
      "Answer a few questions and we'll identify the routes that fit your profile",
    onboarding_voice_tab: "Voice",
    onboarding_chat_tab: "Chat",
    onboarding_form_tab: "Form",
    onboarding_voice_hint: "Speak naturally — our AI will guide the conversation",
    onboarding_chat_hint: "Prefer to type? Chat with our AI assistant",
    onboarding_form_hint: "Fill out the form at your own pace",
    onboarding_progress: "{n} of {total} fields collected",
    onboarding_complete: "Profile complete",

    review_title: "Review your profile",
    review_subtitle:
      "Check that everything looks right before we find your pathways",
    review_crs_estimate: "Estimated CRS range",
    review_crs_disclaimer:
      "Estimate only — complete your full profile on the dashboard for an exact score",
    review_cta: "This looks right — show me my options",
    review_restart: "Start the conversation again",

    field_full_name: "Full name",
    field_date_of_birth: "Date of birth",
    field_nationality: "Nationality",
    field_current_country: "Current country",
    field_marital_status: "Marital status",
    field_spouse_accompanying: "Is your spouse/partner coming to Canada?",
    field_education_level: "Education level",
    field_years_experience: "Years of work experience",
    field_has_canadian_experience: "Work experience in Canada",
    field_occupation: "Current occupation",
    field_language_proficiency: "English/French proficiency",
    field_has_family_in_canada: "Family in Canada",
    field_intended_province: "Preferred province",
    field_annual_income: "Annual income",
    field_income_currency: "Income currency",

    matches_title: "Your profile is ready",
    matches_subtitle:
      "We're identifying the best immigration pathways for your situation",
    matches_go_dashboard: "Go to my dashboard",
  },
  fr: {
    landing_headline:
      "Naviguez votre parcours d'immigration canadienne en toute confiance",
    landing_subhead:
      "Conseils personnalisés alimentés par IA, adaptés à votre profil exact",
    landing_cta: "Commencer — c'est gratuit",
    landing_trust_1: "Basé sur les sources officielles d'IRCC",
    landing_trust_2: "Aucun compte requis pour explorer",
    landing_trust_3: "Mis à jour à chaque changement de politique IRCC",

    auth_title: "Bienvenue sur Pathways",
    auth_subtitle:
      "Entrez votre courriel et nous vous enverrons un lien de connexion sécurisé",
    auth_cta: "Envoyer mon lien de connexion",
    auth_magic_link_sent:
      "Vérifiez votre boîte de réception — votre lien de connexion est en route",
    auth_error_expired: "Ce lien a expiré. Faites une nouvelle demande ci-dessous.",
    auth_error_invalid: "Lien de connexion invalide. Veuillez réessayer.",
    auth_error_generic: "Une erreur est survenue. Veuillez réessayer.",

    onboarding_headline: "Trouvons votre meilleure voie d'immigration",
    onboarding_subhead:
      "Répondez à quelques questions et nous identifierons les voies adaptées à votre profil",
    onboarding_voice_tab: "Voix",
    onboarding_chat_tab: "Clavardage",
    onboarding_form_tab: "Formulaire",
    onboarding_voice_hint: "Parlez naturellement — notre IA guidera la conversation",
    onboarding_chat_hint:
      "Vous préférez écrire ? Clavardez avec notre assistant IA",
    onboarding_form_hint: "Remplissez le formulaire à votre rythme",
    onboarding_progress: "{n} sur {total} champs complétés",
    onboarding_complete: "Profil complet",

    review_title: "Révisez votre profil",
    review_subtitle:
      "Vérifiez que tout est correct avant de trouver vos voies",
    review_crs_estimate: "Fourchette SCR estimée",
    review_crs_disclaimer:
      "Estimation seulement — complétez votre profil complet sur le tableau de bord pour un score exact",
    review_cta: "C'est correct — montrez-moi mes options",
    review_restart: "Recommencer la conversation",

    field_full_name: "Nom complet",
    field_date_of_birth: "Date de naissance",
    field_nationality: "Nationalité",
    field_current_country: "Pays actuel",
    field_marital_status: "État civil",
    field_spouse_accompanying: "Votre conjoint(e) vient-il/elle au Canada ?",
    field_education_level: "Niveau d'études",
    field_years_experience: "Années d'expérience professionnelle",
    field_has_canadian_experience: "Expérience de travail au Canada",
    field_occupation: "Profession actuelle",
    field_language_proficiency: "Niveau d'anglais/français",
    field_has_family_in_canada: "Famille au Canada",
    field_intended_province: "Province préférée",
    field_annual_income: "Revenu annuel",
    field_income_currency: "Devise du revenu",

    matches_title: "Votre profil est prêt",
    matches_subtitle:
      "Nous identifions les meilleures voies d'immigration pour votre situation",
    matches_go_dashboard: "Accéder à mon tableau de bord",
  },
} as const;

export type StringKey = keyof typeof strings.en;

/** Resolve a translated string, interpolating {variable} tokens. */
function resolve(
  locale: Locale,
  key: StringKey,
  vars?: Record<string, string | number>
): string {
  let str: string =
    (strings[locale] as Record<string, string>)[key] ??
    (strings.en as Record<string, string>)[key] ??
    key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}

/**
 * Server-side async translation helper.
 * Reads the locale from the pathways_locale cookie when no locale is passed explicitly.
 */
export async function getT(locale?: Locale) {
  let resolvedLocale = locale;
  if (!resolvedLocale) {
    const cookieStore = await cookies();
    resolvedLocale = (cookieStore.get("pathways_locale")?.value as Locale) ?? "en";
  }
  const loc = resolvedLocale;
  return function t(
    key: StringKey,
    vars?: Record<string, string | number>
  ): string {
    return resolve(loc, key, vars);
  };
}
