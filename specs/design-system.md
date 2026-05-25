# Pathways — Design Specification

> **Claude Code instruction**: Read this file before building any new screen, component, or UI element. Every decision here has been deliberately chosen — follow it precisely.

---

## Brand

- **Product name**: Pathways
- **Tagline**: Your immigration journey, simplified
- **Logo mark**: "Pathways" wordmark in Urbanist Bold + a small filled circle accent in `accent-500`

---

## Visual Direction

**Clean, professional, consumer SaaS.** White and very light grey surfaces. The UI should feel like a premium dashboard — similar in spirit to Linear or Vercel — but warmer and more approachable because our users are individuals navigating a stressful life process, not developers.

**One signature move**: the dark aquamarine accent color (`#0FA896`) applied to key CTAs and status cards, always with a sheen/shimmer effect. Everything else is restrained.

---

## Typography

**Font**: `Urbanist` (Google Fonts) — load weights 400, 500, 600, 700, 800.

```html
<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

| Use | Weight | Size | Notes |
|---|---|---|---|
| Page heading | 700 | 24px | Rare — top of a new section |
| Card title | 700 | 15px | Every card's first line |
| Section label (eyebrow) | 600 | 11px | ALL CAPS, 0.08em tracking |
| Body copy | 400 | 14px | Descriptions, content |
| Body emphasis | 600 | 14px | Key values, numbers |
| Caption / hint | 400 | 12px | Timestamps, placeholders |
| Hero number | 800 | 20–30px | CRS score, large stats |

---

## Color Palette

### Backgrounds
| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#F8F9FA` | Page/app background |
| `bg-surface` | `#FFFFFF` | Cards, panels, modals |
| `bg-subtle` | `#F1F3F4` | Input backgrounds, hover states |
| `bg-muted` | `#E8EAED` | Skeleton loaders, disabled |

### Borders
| Token | Hex | Use |
|---|---|---|
| `border-light` | `#EAEDF0` | Most card borders |
| `border` | `#D8DCE1` | Input borders, dividers |
| `border-strong` | `#BDC4CC` | Focused states, emphasis |

### Text
| Token | Hex | Use |
|---|---|---|
| `text-primary` | `#111827` | Headings, important labels |
| `text-secondary` | `#4B5563` | Body text |
| `text-tertiary` | `#9CA3AF` | Hints, metadata |
| `text-disabled` | `#D1D5DB` | Disabled states |

### Accent — Dark Aquamarine Green
Primary: **`#0FA896`** (`accent-500`)

Use the accent for: primary buttons, active nav indicators, progress fills, key metric labels, status badges for "in progress".

**Never** apply the accent color decoratively. Only use it where there is user intent or action.

### State Colors (badges & indicators only — never for backgrounds of full cards)
| State | Background | Text | Border | Dot |
|---|---|---|---|---|
| Onboarding incomplete | `#FFFBEB` | `#92400E` | `#FDE68A` | `#F59E0B` |
| Pathway not selected | `#EFF6FF` | `#1E40AF` | `#BFDBFE` | `#3B82F6` |
| Application in progress | `#ECFDF8` | `#0B7269` | `#A3F4E2` | `#0FA896` |
| Application submitted | `#F0FDF4` | `#14532D` | `#BBF7D0` | `#22C55E` |

---

## Spacing & Layout

### Dashboard shell
```
┌─────────────────────────────────────────────────┐
│  Sidebar (64px collapsed / 220px open)          │
│  ├── Logo mark at top                           │
│  ├── Nav icons (vertical, icon-only collapsed)  │
│  └── User avatar at bottom                     │
│                                                 │
│  Main content area                              │
│  ├── Top bar: page title + user greeting        │
│  ├── Dashboard state badge                      │
│  └── Card grid (see below)                     │
└─────────────────────────────────────────────────┘
```

### Card gutters
- Between cards: **20px**
- Page outer padding: **28px**

### Card layout — 3 column grid is the default
Cards can span multiple columns. Layout varies per dashboard state (defined below).

---

## Cards

### Base card
- Background: `#FFFFFF`
- Border: `1px solid #EAEDF0`
- Border radius: **16px** — strongly rounded, retains rectangularity
- Box shadow: `0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)`
- Hover: shadow elevates to `card-md`
- Padding: 20px

### Accent card (used for primary CTA or key status)
- Background: `#0D8F80` (`accent-600`)
- Text: white
- Box shadow: `0 4px 20px 0 rgba(15,168,150,0.30)`
- **Sheen effect**: a `::after` pseudo-element sweeps a white gradient highlight across the surface on a 3s loop:
  ```css
  background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 48%, rgba(255,255,255,0.30) 52%, transparent 70%);
  background-size: 200% 100%;
  animation: sheen 3s ease-in-out infinite;
  ```

### Interactive / expandable cards
- Add `cursor: pointer` + hover `transform: translateY(-1px)`
- On click: animate card to fill the viewport using `card-expanding` → `card-expanded` CSS classes (see globals.css)
- The expanded card replaces the main content area with a full-screen detail view
- Always provide a close/back affordance (top-left arrow or ✕)

---

## Buttons

### Primary
- Background: `accent-500` (`#0FA896`) with sheen animation
- Text: white, Urbanist 600, 14px
- Radius: 10px
- Shadow: accent shadow
- Hover: darken to `accent-600`, translate up 1px

### Secondary
- Background: transparent
- Border: `1.5px solid accent-500`
- Text: `accent-600`
- Hover: `accent-50` background fill

### Destructive / ghost — define as needed, no sheen.

---

## Sidebar Navigation

- **Width**: 64px collapsed, 220px open
- **Background**: `#FFFFFF`
- **Border**: `1px solid #EAEDF0` right edge
- **Icon buttons**: 40×40px, `border-radius: 12px`
  - Default: `text-tertiary`
  - Hover: `bg-subtle` background
  - Active: `accent-50` background, `accent-600` icon color
- **Logo**: top of sidebar
- **User avatar**: pinned to bottom

---

## Dashboard States

Four states drive what the dashboard renders. The shell (sidebar + top bar) is always identical. Only the card grid content changes.

### State 1 — Onboarding Incomplete
*User has not finished their profile.*

### State 2 — Pathway Not Selected
*Profile complete, no pathway chosen yet.*

### State 3 — Application In Progress
*Pathway selected, application checklist active.*

### State 4 — Application Submitted
*Application sent; awaiting decisions.*

> **Card-level detail for each state is defined in `dashboard-spec.md` (to be written with the product owner).**

---

## Card Expansion Pattern (Future)

When a card is tapped/clicked to expand:

1. Record the card's `getBoundingClientRect()`
2. Set the card to `position: fixed` at those coordinates
3. Add class `card-expanding` to start the CSS transition
4. In the next frame, add `card-expanded` to animate to full viewport
5. Render the full-screen content inside (fade in with `fade-in` animation)
6. On close: reverse the animation back to origin rect, then restore to normal flow

This pattern means **no routing is required** for card expansion — it's a pure in-page animation. Use a React context (`CardExpansionContext`) to manage which card (if any) is expanded.

---

## Do Nots

- ❌ Never use Inter, Roboto, or system fonts — always Urbanist
- ❌ Never apply the accent color decoratively (borders, backgrounds, icons) unless it signals action or status
- ❌ Never use the sheen effect on non-accent surfaces
- ❌ Never use inline `style` attributes for colors or spacing that exist as tokens — use Tailwind classes or CSS variables
- ❌ Never add more than one accent-colored card per dashboard state
- ❌ Never use `px-` padding smaller than `p-5` (20px) inside cards
- ❌ Never use border-radius smaller than `rounded-2xl` (16px) for cards