# Pathways — Design Tokens
> For Claude: This is the single source of truth for all visual design decisions on the Pathways website. Read this before writing any styles, components, or layouts. Every colour, font, spacing, and radius decision must come from this file.

---

## 1. Core Design Principle

**Preserve and extend the existing landing page design language.** Do not reinvent. The current site has a clean, minimal, typographically-led aesthetic. All new sections and components must feel like they belong to the same family — same rhythm, same restraint, same tone.

The design is: **calm, trustworthy, and quietly premium.** It handles high-stakes decisions (immigration) so it must never feel playful, cluttered, or salesy.

---

## 2. Colour Palette

```css
:root {
  /* --- Primary greens (from the existing landing page) --- */
  --color-green-deep:    #0D4A3A;   /* Deep forest green — hero backgrounds, section accents, primary brand colour */
  --color-green-muted:   #2A5C4E;   /* Slightly lighter — hover states on dark backgrounds */
  --color-green-surface: #1C3D32;   /* Dark green surface variant — cards on dark sections */
  --color-green-light:   #E8F0EE;   /* Very muted, grey-tinted green — light section backgrounds, subtle tints */
  --color-green-tint:    #F2F6F5;   /* Near-white green tint — alternating section backgrounds */

  /* --- Neutrals --- */
  --color-black:         #0A0A0A;   /* Near-black — primary text on light backgrounds */
  --color-grey-900:      #1A1A1A;   /* Dark grey — headings on light bg */
  --color-grey-700:      #3D3D3D;   /* Body text */
  --color-grey-500:      #6B6B6B;   /* Secondary / muted text */
  --color-grey-300:      #C4C4C4;   /* Borders, dividers */
  --color-grey-100:      #F4F4F4;   /* Light background surfaces */
  --color-white:         #FFFFFF;   /* Pure white — text on dark, card backgrounds */

  /* --- Semantic --- */
  --color-success:       #16A34A;
  --color-error:         #DC2626;
  --color-warning:       #D97706;

  /* --- Usage guide ---
    Dark sections (hero, final CTA, footer):
      background: var(--color-green-deep)
      text: var(--color-white)
      secondary text: rgba(255,255,255,0.65)
      borders: rgba(255,255,255,0.12)

    Light sections (features, how it works, FAQ):
      background: var(--color-white) or var(--color-green-tint)
      text: var(--color-grey-900)
      secondary text: var(--color-grey-500)
      borders: var(--color-grey-300)

    Accent sections (social proof, testimonials):
      background: var(--color-green-light)
      text: var(--color-grey-900)

    Never mix green-deep backgrounds with grey text — always use white text on dark green.
  */
}
```

---

## 3. Typography

Match the existing landing page — elegant serif for display/headlines, clean sans-serif for body. This pairing is already established; maintain it exactly.

```css
:root {
  /* Font families — match what is already imported in the project */
  --font-display: 'Playfair Display', 'Georgia', serif;   /* Headlines, hero text */
  --font-body:    'Inter', 'system-ui', sans-serif;        /* Body, UI, labels */

  /* Type scale */
  --text-xs:    0.75rem;    /* 12px — captions, legal */
  --text-sm:    0.875rem;   /* 14px — labels, secondary */
  --text-base:  1rem;       /* 16px — body default */
  --text-lg:    1.125rem;   /* 18px — lead / intro text */
  --text-xl:    1.25rem;    /* 20px — small headings */
  --text-2xl:   1.5rem;     /* 24px */
  --text-3xl:   1.875rem;   /* 30px */
  --text-4xl:   2.25rem;    /* 36px — section headings */
  --text-5xl:   3rem;       /* 48px — page headings */
  --text-6xl:   3.75rem;    /* 60px — hero headline desktop */
  --text-7xl:   4.5rem;     /* 72px — large hero variant */
}

@media (max-width: 767px) {
  :root {
    --text-6xl: 2.5rem;   /* Scale hero down on mobile */
    --text-5xl: 2rem;
    --text-4xl: 1.75rem;
  }
}
```

**Rules:**
- `--font-display` is used ONLY for hero headlines, section headlines, and pull quotes
- `--font-body` is used for everything else: body text, nav, buttons, labels, cards
- Font weight: `400` body, `500` medium emphasis, `600` subheadings, `700` bold headings
- Line height: `1.6` body, `1.15` display headings
- Letter spacing: `-0.02em` on large display text, `0` on body
- Max line length: `65ch` for body paragraphs, `22ch`–`28ch` for hero headlines
- Never use `--font-display` below `--text-2xl`

---

## 4. Spacing System

4px base unit. All spacing is a multiple of 4.

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
  --space-32: 128px;
}

/* Section vertical padding */
.section {
  padding-top: var(--space-24);
  padding-bottom: var(--space-24);
}

@media (max-width: 1279px) {
  .section {
    padding-top: var(--space-16);
    padding-bottom: var(--space-16);
  }
}

@media (max-width: 767px) {
  .section {
    padding-top: var(--space-12);
    padding-bottom: var(--space-12);
  }
}
```

---

## 5. Border Radius

```css
:root {
  --radius-sm:   4px;    /* Subtle — tags, badges */
  --radius-md:   8px;    /* Inputs, small cards */
  --radius-lg:   12px;   /* Cards, modals */
  --radius-xl:   16px;   /* Large cards */
  --radius-2xl:  24px;   /* Feature blocks */
  --radius-full: 9999px; /* Pills, avatars */
}
```

---

## 6. Shadows

```css
:root {
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.08);
  --shadow-md:  0 4px 16px rgba(0,0,0,0.08);
  --shadow-lg:  0 8px 32px rgba(0,0,0,0.10);
  --shadow-xl:  0 16px 48px rgba(0,0,0,0.12);

  /* Green-tinted shadow for cards on light backgrounds */
  --shadow-green: 0 8px 32px rgba(13,74,58,0.12);
}
```

---

## 7. Topographic Texture

The existing site uses a subtle topographic map line pattern as a background texture on dark green sections. Preserve this on all `--color-green-deep` backgrounds.

```css
/* Apply to any dark green section */
.bg-green-textured {
  background-color: var(--color-green-deep);
  background-image: url('/textures/topo-lines.svg');
  background-repeat: repeat;
  background-size: 600px 600px;
  background-blend-mode: overlay;
  opacity on texture layer: 0.08; /* Very subtle — should feel like texture, not pattern */
}
```

If the texture SVG doesn't exist yet, generate a subtle repeating topographic contour line SVG and place it at `/public/textures/topo-lines.svg`.

---

## 8. Animation & Motion

```css
:root {
  --transition-fast:   150ms ease;
  --transition-base:   250ms ease;
  --transition-slow:   400ms ease;
  --transition-spring: 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Scroll-triggered fade-up (use with Framer Motion or Intersection Observer) */
.fade-up {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity var(--transition-slow), transform var(--transition-slow);
}
.fade-up.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Keep animations minimal and purposeful. Scroll-triggered fade-ups on section entry only. No parallax, no continuous looping animations except the hero video background.

---

## 9. Tailwind CSS v4 Config Extension

Add these to your `tailwind.config.ts` to make tokens available as Tailwind utilities:

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        green: {
          deep:    '#0D4A3A',
          muted:   '#2A5C4E',
          surface: '#1C3D32',
          light:   '#E8F0EE',
          tint:    '#F2F6F5',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        green: '0 8px 32px rgba(13,74,58,0.12)',
      },
    },
  },
}

export default config
```