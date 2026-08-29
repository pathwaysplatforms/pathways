/**
 * Pathways Design Tokens
 * Single source of truth for all design values.
 * Use these in components that need programmatic access to tokens
 * (e.g. inline styles, canvas rendering, dynamic theming).
 * For Tailwind/CSS usage, prefer the classes and CSS variables in globals.css.
 */

export const colors = {
    // Backgrounds
    bg: {
      base:    "#EDEEF2",
      surface: "#FFFFFF",
      subtle:  "#F1F3F4",
      muted:   "#E8EAED",
    },
  
    // Borders
    border: {
      light:   "#EAEDF0",
      default: "#D8DCE1",
      strong:  "#BDC4CC",
    },
  
    // Text
    text: {
      primary:   "#111827",
      secondary: "#4B5563",
      tertiary:  "#9CA3AF",
      disabled:  "#D1D5DB",
    },
  
    // Accent — teal
    accent: {
      50:  "#ebfafb",
      100: "#cdf3f5",
      200: "#9de8ec",
      300: "#5cd4db",
      400: "#1ab8c4",
      500: "#14909c",   // primary accent
      600: "#107581",
      700: "#0d5d68",
      800: "#0a4750",
      900: "#072f38",
    },
  
    // Dashboard state colors
    status: {
      // State 1: Onboarding incomplete
      onboarding: {
        bg:     "#FFFBEB",
        text:   "#92400E",
        border: "#FDE68A",
        dot:    "#F59E0B",
      },
      // State 2: No pathway selected
      pathway: {
        bg:     "#EFF6FF",
        text:   "#1E40AF",
        border: "#BFDBFE",
        dot:    "#3B82F6",
      },
      // State 3: Application in progress
      inProgress: {
        bg:     "#ebfafb",
        text:   "#0d5d68",
        border: "#9de8ec",
        dot:    "#14909c",
      },
      // State 4: Application submitted
      submitted: {
        bg:     "#F0FDF4",
        text:   "#14532D",
        border: "#BBF7D0",
        dot:    "#22C55E",
      },
    },
  } as const;
  
  export const radii = {
    card:  "16px",
    panel: "20px",
    btn:   "10px",
    input: "10px",
    badge: "8px",
    icon:  "12px",
    pill:  "9999px",
  } as const;
  
  export const spacing = {
    gutter:     "20px",
    gutterLg:   "28px",
    sidebarCollapsed: "64px",
    sidebarOpen:      "220px",
  } as const;
  
  export const shadows = {
    card:    "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)",
    cardMd:  "0 4px 12px 0 rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04)",
    cardLg:  "0 8px 24px 0 rgba(0,0,0,0.09), 0 4px 8px -2px rgba(0,0,0,0.05)",
    sidebar: "2px 0 12px 0 rgba(0,0,0,0.05)",
    accent:  "0 4px 20px 0 rgba(15,168,150,0.30), 0 1px 4px 0 rgba(15,168,150,0.20)",
  } as const;
  
  export const typography = {
    fontFamily: "'Urbanist', sans-serif",
    weights: {
      normal:    400,
      medium:    500,
      semibold:  600,
      bold:      700,
      extrabold: 800,
    },
    sizes: {
      eyebrow: "11px",   // all-caps section labels
      caption: "12px",   // timestamps, hints
      body:    "14px",   // default body
      bodyLg:  "15px",   // card titles
      lg:      "16px",   // subheadings
      xl:      "20px",   // card hero numbers
      "2xl":   "24px",   // page headings
      "3xl":   "30px",   // large display
    },
  } as const;
  
  // ─── Dashboard state definitions ────────────────────────────────────
  // Used to drive conditional rendering across all 4 dashboard states.
  export type DashboardState =
    | "onboarding_incomplete"
    | "pathway_not_selected"
    | "application_in_progress"
    | "application_submitted";
  
  export const dashboardStateConfig: Record<DashboardState, {
    label: string;
    badgeClass: string;
    color: typeof colors.status[keyof typeof colors.status];
  }> = {
    onboarding_incomplete: {
      label: "Complete your profile",
      badgeClass: "badge-warning",
      color: colors.status.onboarding,
    },
    pathway_not_selected: {
      label: "Choose a pathway",
      badgeClass: "badge-info",
      color: colors.status.pathway,
    },
    application_in_progress: {
      label: "Application in progress",
      badgeClass: "badge-progress",
      color: colors.status.inProgress,
    },
    application_submitted: {
      label: "Application submitted",
      badgeClass: "badge-success",
      color: colors.status.submitted,
    },
  } as const;