# Application Flow UI Spec
## Post-Pathway Selection Experience

> **Design references:** `tailwind.config.ts` and `specs/design-system.md` are the source of
> truth for all colours, typography, spacing, border radius, and shadow tokens.
> Do not hardcode any values — always use the tokens defined there.

---

## Overview

After a user selects a pathway (e.g. Federal Skilled Worker), they land on the
**Application View** — a two-column layout that guides them through their
immigration application one step at a time.

This spec covers:
1. Application View layout (two-column)
2. Step card (left column) — the active step the user must complete
3. Progress tracker (right column) — floating card showing all steps
4. Document Upload Modal — triggered from within a step card
5. Mocked data shapes — used until the backend matcher is wired in

---

## 1. Route

```
/application/[applicationId]
```

For the UI shell, `applicationId` can be a mock string. The page should accept
either a real UUID from `applications` or a `?mock=true` query param that loads
the mock data defined in section 5.

---

## 2. Page Layout

Two-column layout, fixed on desktop, stacked on mobile.

```
┌─────────────────────────────────┬───────────────────────┐
│                                 │                       │
│   Step Card (active step)       │   Progress Tracker    │
│   — grows to fill content       │   — sticky / floating │
│                                 │                       │
│                                 │                       │
└─────────────────────────────────┴───────────────────────┘
```

- Left column: `flex-1` (takes remaining width)
- Right column: fixed width (`w-80`), sticky (`sticky top-6`), `self-start`
- Outer wrapper: `max-w-6xl mx-auto px-6 py-8`
- Gap between columns: `gap-6`
- On mobile (`< md`): right column moves below left column

Above the two columns, render a slim **page header**:
- Pathway name (e.g. "Federal Skilled Worker Program")
- Status badge (e.g. "In Progress")
- Back link: "← My Dashboard"

---

## 3. Step Card (Left Column)

Renders the **current active step** the user needs to complete.

### Card shell
- Standard card styling from design system (background, border, radius, shadow)
- Padding: `p-6`
- Step number badge at top left: small pill, e.g. "Step 3 of 10"
- Step title: heading size from design system
- Step description: body text, muted colour
- Bottom: primary CTA button + optional secondary link

### Step types

Each step has a `type` field that determines what renders inside the card.
Implement all four types as distinct sub-components:

| Type | Component | Description |
|------|-----------|-------------|
| `document_upload` | `DocumentUploadStep` | Upload one or more required documents. Triggers the Document Upload Modal. |
| `information` | `InformationStep` | User fills in a form with profile fields (text, select, date inputs). |
| `external_action` | `ExternalActionStep` | User must do something outside the app (e.g. book a medical exam). Shows instructions + a checkbox to confirm done. |
| `review` | `ReviewStep` | Summary of what's been collected so far. User confirms and moves forward. |

### Step navigation
- "Mark as complete / Continue" primary button advances to the next step
- "Back" secondary link goes to previous step (no data loss)
- Completed steps cannot be edited from this card — user must use the progress
  tracker to jump back (future feature, stub for now)

---

## 4. Progress Tracker (Right Column)

Floating card showing all steps in the application.

### Card shell
- Same card styling as step card
- `sticky top-6 self-start`
- Header: "Your Progress" + percentage complete (e.g. "30%")
- Progress bar beneath the header (use design system accent colour)

### Step list

Render each step as a row:

```
[icon] Step title                    [status badge]
```

**Status states:**

| State | Icon | Style |
|-------|------|-------|
| `completed` | Checkmark circle (filled) | Muted / strikethrough title |
| `current` | Filled dot or ring | Accent colour, bold title, highlighted row |
| `upcoming` | Empty circle | Muted text |
| `blocked` | Lock icon | Muted text + tooltip "Complete previous steps first" |

- Clicking a `completed` step row is a no-op for now (stub for future jump-to-step)
- The current step row should be visually distinct — use a left border accent or
  background highlight consistent with the design system

### Footer
- "Need help?" link at bottom of tracker card (stub — no action yet)

---

## 5. Document Upload Modal

Triggered when the user clicks the upload CTA inside a `DocumentUploadStep`.

### Trigger
```tsx
// Inside DocumentUploadStep
<Button onClick={() => setUploadModalOpen(true)}>
  Upload {document.name}
</Button>
```

### Modal structure

Use the existing modal/dialog component from the design system.

**Header:** Document name (e.g. "Language Test Results")

**Body — three sections:**

#### Section A: What this document is
- Short description of the document (from `document_requirements.description`)
- Validity period if applicable (e.g. "Must be less than 2 years old")
- Link: "Not sure what this is? Get help →" (stub)

#### Section B: AI Document Support (key feature)
A highlighted panel (use a subtle accent background from design system):

```
✦ AI Document Support

We can help you:
• Understand exactly what version of this document you need
• Generate a template or covering letter (where applicable)
• Check if your document meets the requirements before you upload

[Ask AI about this document]   [Generate template]
```

Both buttons are stubs for now — they should open a placeholder state with
"Coming soon" copy. The panel design should feel native to the design system,
not bolted on.

#### Section C: Upload area
- Drag-and-drop zone with dashed border
- "or click to browse" fallback
- Accepted formats listed below: PDF, JPG, PNG (max 10MB)
- On file selection: show filename + size + remove button
- Upload button: disabled until a file is selected

**Footer:**
- "Cancel" (closes modal, no state change)
- "Upload Document" primary button (disabled until file selected)

### Modal states
| State | What renders |
|-------|-------------|
| `idle` | Default view above |
| `uploading` | Progress indicator, buttons disabled |
| `success` | Green confirmation, "Document uploaded" message, auto-close after 2s |
| `error` | Red error message, retry button |

For the UI shell, simulate `uploading` → `success` with a 1.5s timeout on
button click. No actual file upload needed yet.

---

## 6. Mock Data

Use this shape to render the shell without a real backend. Put it in
`src/modules/pathways/mock-application.ts`.

```ts
export const mockApplication = {
  id: 'mock-application-1',
  pathway: {
    slug: 'express-entry-fsw',
    title: 'Federal Skilled Worker Program',
    official_name: 'Federal Skilled Worker Program (FSWP)',
  },
  status: 'in_progress',
  steps: [
    {
      id: 'step-1',
      step_number: 1,
      title: 'Check FSW 67-point eligibility',
      description: 'Verify you score at least 67/100 on the FSW selection grid.',
      type: 'information',
      status: 'completed',
      estimated_duration: '1 day',
      is_optional: false,
    },
    {
      id: 'step-2',
      step_number: 2,
      title: 'Language test results',
      description: 'Upload your IELTS, CELPIP, TEF, or TCF results. Must be less than 2 years old.',
      type: 'document_upload',
      status: 'current',
      estimated_duration: '4–8 weeks',
      is_optional: false,
      document: {
        name: 'Language Test Results',
        description: 'IELTS General Training, CELPIP General, TEF Canada, or TCF Canada showing CLB 7 or above in all four abilities.',
        document_type: 'language_test',
        validity_period: '2 years',
        accepted_formats: ['PDF', 'JPG', 'PNG'],
        max_size_mb: 10,
      },
    },
    {
      id: 'step-3',
      step_number: 3,
      title: 'Educational Credential Assessment',
      description: 'Get your foreign degree assessed by WES or another designated body.',
      type: 'document_upload',
      status: 'upcoming',
      estimated_duration: '4–8 weeks',
      is_optional: false,
      document: {
        name: 'ECA Report',
        description: 'ECA from WES, IQAS, ICAS, or another IRCC-designated organisation.',
        document_type: 'eca_report',
        validity_period: '5 years',
        accepted_formats: ['PDF'],
        max_size_mb: 10,
      },
    },
    {
      id: 'step-4',
      step_number: 4,
      title: 'Employment reference letters',
      description: 'Collect letters from each employer covering the last 10 years.',
      type: 'document_upload',
      status: 'upcoming',
      estimated_duration: '2–4 weeks',
      is_optional: false,
      document: {
        name: 'Employment Reference Letters',
        description: 'On company letterhead, confirming job title, duties, hours per week, salary, and dates.',
        document_type: 'employment_reference',
        validity_period: null,
        accepted_formats: ['PDF', 'JPG', 'PNG'],
        max_size_mb: 10,
      },
    },
    {
      id: 'step-5',
      step_number: 5,
      title: 'Proof of settlement funds',
      description: 'Bank statements showing at least $14,690 CAD.',
      type: 'document_upload',
      status: 'upcoming',
      estimated_duration: '1 week',
      is_optional: false,
      document: {
        name: 'Bank Statements',
        description: 'Showing sufficient funds held for at least 6 months. Single applicant: $14,690 CAD minimum.',
        document_type: 'bank_statement',
        validity_period: '6 months',
        accepted_formats: ['PDF'],
        max_size_mb: 10,
      },
    },
    {
      id: 'step-6',
      step_number: 6,
      title: 'Create Express Entry profile',
      description: 'Submit your profile on the IRCC portal. Your CRS score is assigned automatically.',
      type: 'external_action',
      status: 'upcoming',
      estimated_duration: '1–2 days',
      is_optional: false,
    },
    {
      id: 'step-7',
      step_number: 7,
      title: 'Enter the pool & await ITA',
      description: 'Your profile is live. Monitor your CRS score and draw results.',
      type: 'external_action',
      status: 'upcoming',
      estimated_duration: '1–12 months',
      is_optional: false,
    },
    {
      id: 'step-8',
      step_number: 8,
      title: 'Submit e-APR within 60 days',
      description: 'Upload all documents through the IRCC portal after receiving your ITA.',
      type: 'review',
      status: 'upcoming',
      estimated_duration: '2–4 weeks',
      is_optional: false,
    },
    {
      id: 'step-9',
      step_number: 9,
      title: 'Biometrics & medical exam',
      description: 'Complete fingerprints and medical examination.',
      type: 'external_action',
      status: 'upcoming',
      estimated_duration: '2–4 weeks',
      is_optional: false,
    },
    {
      id: 'step-10',
      step_number: 10,
      title: 'Receive Confirmation of PR',
      description: 'IRCC issues your COPR. Land in Canada before expiry.',
      type: 'external_action',
      status: 'upcoming',
      estimated_duration: '1–6 months',
      is_optional: false,
    },
  ],
}
```

---

## 7. File Structure to Create

```
src/app/application/
  [applicationId]/
    page.tsx                          ← Route entry point, loads mock or real data

src/components/application/
  ApplicationLayout.tsx               ← Two-column wrapper + page header
  StepCard.tsx                        ← Active step shell (step number, title, desc, CTA)
  ProgressTracker.tsx                 ← Right column sticky card
  steps/
    DocumentUploadStep.tsx            ← Renders upload CTA, triggers modal
    InformationStep.tsx               ← Form fields (stub inputs for now)
    ExternalActionStep.tsx            ← Instructions + confirm checkbox
    ReviewStep.tsx                    ← Summary list (stub)
  modals/
    DocumentUploadModal.tsx           ← Full modal with three sections + states

src/modules/pathways/
  mock-application.ts                 ← Mock data from section 6
```

---

## 8. Implementation Notes for Cursor

- **All styling** must use tokens from `tailwind.config.ts` and patterns from
  `specs/design-system.md`. Do not introduce new colours or spacing values.
- Use existing UI primitives (Button, Card, Badge, Dialog, Progress) already in
  the project. Do not install new component libraries.
- The Document Upload Modal AI panel (Section B) is **UI only** — both buttons
  render a "Coming soon" toast or inline message. No API calls.
- File upload in the modal is **simulated** — `setTimeout` for 1.5s then show
  success state. No actual Supabase storage call yet.
- `page.tsx` should check for `?mock=true` and load `mock-application.ts`
  instead of querying the DB. This lets the shell work before the matcher exists.
- Keep all components **server-component-safe** where possible. Only add
  `'use client'` where interactivity requires it (modal, step navigation state).
- TypeScript types for `Step`, `StepType`, `StepStatus`, `DocumentRequirement`
  should be defined in `src/modules/pathways/types.ts` and shared across all
  components.