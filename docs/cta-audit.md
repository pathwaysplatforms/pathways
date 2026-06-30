# CTA Placement Audit

Covers every page and modal in `/app` (authenticated routes). Opportunities are flagged only — nothing implemented here.

## Scoring key
- **Priority**: High / Medium / Low
- **Type**: Primary (black fill) · Secondary (border) · Tertiary (text only)
- **Status**: Missing · Present–weak · Present–correct

---

## Pages

### `/dashboard` (Dashboard Home)

| Location | Current CTA | Gap / Opportunity | Priority |
|---|---|---|---|
| No-pathway state (state 2) | None visible | Add primary "Choose a pathway →" linking to `/onboarding/matches`. The state text says "Select a pathway" but there is no action button. | **High** |
| Pathway-selected state (state 3 card A) | "Continue application" (white fill on dark card) | Present–correct. | — |
| "Ask Pathways" entry link | Text link with border | Consider making this secondary button style for visual consistency (it is the only interactive element in the footer strip). | Low |
| "Redo my onboarding" link | Muted underlined text | Correct as tertiary; intentionally de-emphasised. | — |

---

### `/dashboard/application` (Application page)

| Location | Current CTA | Gap / Opportunity | Priority |
|---|---|---|---|
| No-data state | "Browse pathways →" pill button | Present. Pill border-radius (9999) is inconsistent with the 8px standard — flag for button audit. | Low |
| Error state | "Retry" pill | Same border-radius issue. | Low |
| Sidebar — step list | Steps are clickable list items, no CTA | A "Start this step" primary button could be added at the bottom of the sidebar for the current step, to give users a clear next action without opening the drawer. | Medium |
| `StepDetailDrawer` — "Mark as complete" | Present (secondary-weight styling) | Present–correct. | — |
| `StepDetailDrawer` — "Generate Cover Letter" | Present (secondary) | Present–correct. | — |

---

### `/dashboard/documents` (Documents)

| Location | Current CTA | Gap / Opportunity | Priority |
|---|---|---|---|
| Upload zone | Functional drop-zone with "click to upload" text | No explicit primary button label inside the zone. An "Upload document" button label inside the zone would clarify the action (especially on mobile where drag-drop is unavailable). | Medium |
| Requirement card — "Start" / "Upload" | None visible in checklist | Each unfulfilled requirement in the checklist could carry a tertiary "Upload ↑" link that pre-selects the requirement in the upload modal. | Medium |
| Vault — empty state (placeholder cards) | No CTA on placeholder cards | Ghost placeholder cards are correctly muted. No CTA needed here — the upload zone above is the canonical entry point. | — |

---

### `/dashboard/profile` (Profile)

| Location | Current CTA | Gap / Opportunity | Priority |
|---|---|---|---|
| CRS score hero card | "View full breakdown →" link | Present as accent-colour text link. Could be raised to tertiary button for discoverability, but current treatment is reasonable. | Low |
| Each `SectionCard` | "Edit" text button (top-right) | Present–correct. | — |
| "Recalculate CRS" | Small secondary button in CRS hero | Present. Consider moving to a more prominent position after the user saves a section — the recalculate action is most useful right after editing. | Low |
| Error state | "Retry" pill | Pill border-radius inconsistency (same as above). | Low |

---

### `/dashboard/account` (Account / Settings)

| Location | Current CTA | Gap / Opportunity | Priority |
|---|---|---|---|
| Email verification section | "Send verification email" button | Present–correct. | — |
| Password section | None | Guest accounts have a password; magic-link accounts do not. No CTA needed unless we add "change password" flow. | — |
| Subscription section | No upgrade CTA for `free` plan users | **High-value gap**: free-plan users see their plan label but have no path to upgrade. Add a primary "Upgrade to Pro" button. | **High** |
| "Danger Zone" — delete account | "Delete account" destructive button | Present–correct. | — |
| Error state | "Retry" anchor with `borderRadius: 0` | Fix border-radius to 8 (already flagged in button audit — confirm it landed). | Low |

---

### `/dashboard/ask` (Ask Pathways — Q&A chatbot)

| Location | Current CTA | Gap / Opportunity | Priority |
|---|---|---|---|
| Suggestion chips (sidebar) | Present as clickable suggestion buttons | Present–correct. | — |
| Empty chat state | No send CTA visible until user types | Standard chat-input behaviour — acceptable. | — |
| Post-answer | No follow-up CTA (e.g., "Apply to this pathway") | After the assistant recommends a pathway, a tertiary "View pathway →" link in the response could drive conversion. Requires changes to the AI response rendering layer. | Medium |

---

### `/dashboard/crs` (CRS Score explainer)

| Location | Current CTA | Gap / Opportunity | Priority |
|---|---|---|---|
| Score header | No CTA | An "Update your profile to improve your estimate" tertiary link to `/dashboard/profile` would close the loop after the user sees their score. | Medium |
| Improvement levers section | No CTA per lever | Provincial nomination lever could link to relevant pathway. French language lever could link to a language-prep pathway. These are content decisions, not just CTA placement. | Low |
| "Open official IRCC CRS tool" | External link (present) | Present–correct. | — |

---

### `/dashboard/draws` (Express Entry Draws history)

| Location | Current CTA | Gap / Opportunity | Priority |
|---|---|---|---|
| Page header | No CTA | A "Check if your score qualifies" link to `/dashboard/crs` would connect the reference data to the user's own situation. | Medium |
| Below the chart | No CTA | "Start your Express Entry application" primary button, conditionally shown for users without an active application, would convert reference-browsing intent into action. | Medium |

---

## Modals

### `StepDetailDrawer`

| Location | Current CTA | Gap / Opportunity | Priority |
|---|---|---|---|
| Required documents list | Document names listed, no action | A tertiary "Upload ↑" link per document name that deep-links into the Documents tab would close the gap between knowing a document is needed and uploading it. | **High** |
| "Official source" external link | Present | Present–correct. | — |

---

### Onboarding `SaveResultsModal` (guest → account upgrade)

| Location | Current CTA | Gap / Opportunity | Priority |
|---|---|---|---|
| Primary CTA | "Create account & save" button | Present–correct. | — |
| Secondary | "Continue as guest" / dismiss | Present–correct. | — |

---

## Summary of high-priority gaps

1. **Dashboard no-pathway state** — no primary CTA to select a pathway (state 2 is a dead end)
2. **Account settings — upgrade CTA** — free-plan users have no path to upgrade; high revenue impact
3. **StepDetailDrawer document list** — no link from required document names to the Documents upload tab
