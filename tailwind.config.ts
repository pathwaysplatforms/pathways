import type { Config } from "tailwindcss";
 
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
        extrabold: "800",
      },
 
      // ─── Typography ───────────────────────────────────────────────
      fontFamily: {
        sans:    ["Urbanist", "sans-serif"],
        display: ["Urbanist", "sans-serif"],
        body:    ["DM Sans", "system-ui", "sans-serif"],
      },

      // ─── Color Palette ────────────────────────────────────────────
      colors: {
        // Website deep forest green palette (from specs/website-design-tokens.md)
        forest: {
          deep:    "#0D4A3A",
          muted:   "#2A5C4E",
          surface: "#1C3D32",
          light:   "#E8F0EE",
          tint:    "#F2F6F5",
        },

        // Swiss Particle Brutalism palette
        pw: {
          bg:       "#FFFFFF",
          ink:      "#0D0D0D",
          muted:    "#6B6B6B",
          accent:   "#1A56DB",
          particle: "#1A1A1A",
          surface:  "#F7F7F5",
        },
        // Backgrounds
        bg: {
          base: "#EDEEF2",      // page background — light grey
          surface: "#FFFFFF",   // card / panel surface
          subtle: "#F1F3F4",    // input backgrounds, dividers
          muted: "#E8EAED",     // skeleton loaders, disabled states
        },

        // Borders
        border: {
          light: "#EAEDF0",
          DEFAULT: "#D8DCE1",
          strong: "#BDC4CC",
        },

        // Text
        text: {
          primary: "#111827",   // headings, important labels
          secondary: "#4B5563", // body copy, descriptions
          tertiary: "#9CA3AF",  // hints, placeholders, timestamps
          disabled: "#D1D5DB",
        },

        // Accent — teal
        accent: {
          50:  "#ebfafb",
          100: "#cdf3f5",
          200: "#9de8ec",
          300: "#5cd4db",
          400: "#1ab8c4",
          500: "#14909c",   // ← primary accent (use this most)
          600: "#107581",
          700: "#0d5d68",
          800: "#0a4750",
          900: "#072f38",
          950: "#041e25",
        },

        // Status colors — used sparingly for state indicators only
        status: {
          // Onboarding incomplete
          warning: {
            bg:     "#FFFBEB",
            text:   "#92400E",
            border: "#FDE68A",
            dot:    "#F59E0B",
          },
          // Pathway not yet chosen
          info: {
            bg:     "#EFF6FF",
            text:   "#1E40AF",
            border: "#BFDBFE",
            dot:    "#3B82F6",
          },
          // Application in progress
          progress: {
            bg:     "#ECFDF8",
            text:   "#0B7269",
            border: "#A3F4E2",
            dot:    "#0FA896",
          },
          // Application submitted
          success: {
            bg:     "#F0FDF4",
            text:   "#14532D",
            border: "#BBF7D0",
            dot:    "#22C55E",
          },
        },
      },

      // ─── Spacing / Layout ─────────────────────────────────────────
      spacing: {
        // Dashboard gutters — thick as specified
        "gutter":    "20px",   // between cards
        "gutter-lg": "28px",   // outer page padding
        "sidebar":   "64px",   // collapsed sidebar width
        "sidebar-open": "220px",
      },

      // ─── Border Radius ────────────────────────────────────────────
      borderRadius: {
        // Strongly rounded, retains rectangularity
        card:  "16px",
        panel: "20px",
        pill:  "9999px",
        badge: "8px",
        input: "10px",
        btn:   "10px",
        icon:  "12px",
      },

      // ─── Shadows ──────────────────────────────────────────────────
      boxShadow: {
        card:     "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)",
        "card-md":"0 4px 12px 0 rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04)",
        "card-lg":"0 8px 24px 0 rgba(0,0,0,0.09), 0 4px 8px -2px rgba(0,0,0,0.05)",
        sidebar:  "2px 0 12px 0 rgba(0,0,0,0.05)",
        // Accent card / button sheen shadow
        accent:   "0 4px 20px 0 rgba(20,144,156,0.30), 0 1px 4px 0 rgba(20,144,156,0.20)",
      },

      // ─── Transitions ──────────────────────────────────────────────
      transitionDuration: {
        fast:   "120ms",
        normal: "200ms",
        slow:   "350ms",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        calm:   "cubic-bezier(0.16, 1, 0.3, 1)",
      },

      // ─── Animation ────────────────────────────────────────────────
      keyframes: {
        // Card expand (for future card expansion feature)
        "card-expand": {
          "0%":   { transform: "scale(1)", borderRadius: "16px" },
          "100%": { transform: "scale(1)", borderRadius: "20px" },
        },
        // Sheen sweep for accent cards/buttons
        sheen: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        sheen:    "sheen 2.4s linear infinite",
        "fade-up":"fade-up 0.3s cubic-bezier(0.4,0,0.2,1) both",
        "fade-in":"fade-in 0.25s ease both",
      },
    },
  },
  plugins: [],
};
 
export default config;