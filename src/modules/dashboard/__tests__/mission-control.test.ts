import { describe, it, expect } from 'vitest';
import { deriveMissionControl, JOURNEY_PHASES } from '../mission-control';
import type { DashboardData, EnrichedApplicationStep } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeStep(n: number, status: EnrichedApplicationStep['status']): EnrichedApplicationStep {
  return {
    id: `step-${n}`,
    stepNumber: n,
    label: `Step ${n}`,
    description: `Description ${n}`,
    estimatedDuration: '2 weeks',
    status,
  };
}

/** Complete-onboarding, no committed pathway (discovering) baseline. */
function makeData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    state: 'pathway_not_selected',
    firstName: 'Jane',
    avatarInitials: 'JS',
    profileCompleteness: 85,
    onboardingStatus: 'complete',
    incompleteFields: [],
    onboardingSteps: [],
    recommendedPathways: [],
    applicationId: null,
    applicationStatus: null,
    applicationSubmittedAt: null,
    pathwayTitle: null,
    pathwayOfficialName: null,
    processingTimeMin: null,
    processingTimeMax: null,
    applicationSteps: [],
    documents: [],
    completedStepsCount: 0,
    totalStepsCount: 0,
    pendingDocumentsCount: 0,
    completedDocumentsCount: 0,
    recommendations: [],
    crsScore: 470,
    crsRangeLow: 440,
    crsRangeHigh: 500,
    crsConfidence: null,
    crsBreakdown: null,
    crsClbPlusOneDelta: null,
    selectedPathwaySlug: null,
    selectedPathwayTitle: null,
    selectedPathwayProcessingTime: null,
    selectedPathwayDescription: null,
    selectedPathwaySteps: [],
    profileContext: {
      fullName: 'Jane Smith',
      occupation: null,
      degreeLevel: null,
      degreeField: null,
      nationality: null,
    },
    nationalityVoice: null,
    latestDraw: null,
    applicationPathwaySlug: null,
    ...overrides,
  };
}

/** Committed-pathway (executing) baseline with a live draw and breakdown. */
function makeExecutingData(overrides: Partial<DashboardData> = {}): DashboardData {
  return makeData({
    applicationId: 'app-1',
    pathwayTitle: 'Federal Skilled Worker',
    applicationPathwaySlug: 'federal-skilled-worker',
    processingTimeMin: '6 months',
    processingTimeMax: '12 months',
    latestDraw: {
      cutoffScore: 510,
      drawDate: '2026-06-20',
      drawType: 'FSW',
      invitationsIssued: 3000,
    },
    crsBreakdown: {
      age: 100,
      education: 120,
      language: 80,
      experience: 40,
      transferability: 50,
      additional: 0,
    },
    crsClbPlusOneDelta: 18,
    ...overrides,
  });
}

// ─── State derivation ─────────────────────────────────────────────────────────

describe('deriveMissionControl — state', () => {
  it('returns onboarding when onboarding_status is not complete, suppressing everything else', () => {
    const model = deriveMissionControl(
      makeData({ onboardingStatus: 'voice_complete', crsScore: 470 })
    );
    expect(model.state).toBe('onboarding');
    expect(model.actions).toEqual([]);
    expect(model.levers).toEqual([]);
    expect(model.crsScore).toBeNull();
    expect(model.crsGap).toBeNull();
    expect(model.journeyPhase).toBe('profile');
  });

  it('returns discovering when complete with no application and no selected slug', () => {
    const model = deriveMissionControl(makeData());
    expect(model.state).toBe('discovering');
    expect(model.journeyPhase).toBe('pathway');
  });

  it('returns executing when an application row exists', () => {
    expect(deriveMissionControl(makeExecutingData()).state).toBe('executing');
  });

  it('returns executing when only selected_pathway_slug is committed', () => {
    const model = deriveMissionControl(
      makeData({ selectedPathwaySlug: 'express-entry', selectedPathwayTitle: 'Express Entry' })
    );
    expect(model.state).toBe('executing');
    expect(model.pathwayTitle).toBe('Express Entry');
    expect(model.journeyPhase).toBe('documents');
  });
});

// ─── Journey phase ────────────────────────────────────────────────────────────

describe('deriveMissionControl — journey phase', () => {
  it('exposes all six phases in order', () => {
    expect(JOURNEY_PHASES.map((p) => p.id)).toEqual([
      'profile', 'eligibility', 'pathway', 'documents', 'application', 'submitted',
    ]);
  });

  it('is application while an application row is unsubmitted', () => {
    expect(deriveMissionControl(makeExecutingData()).journeyPhase).toBe('application');
  });

  it('is submitted once submitted_at is set', () => {
    const model = deriveMissionControl(
      makeExecutingData({ applicationSubmittedAt: '2026-06-01T00:00:00Z' })
    );
    expect(model.journeyPhase).toBe('submitted');
  });
});

// ─── CRS gap null discipline ──────────────────────────────────────────────────

describe('deriveMissionControl — CRS gap', () => {
  it('computes gap as score minus cutoff in executing state', () => {
    expect(deriveMissionControl(makeExecutingData({ crsScore: 490 })).crsGap).toBe(-20);
    expect(deriveMissionControl(makeExecutingData({ crsScore: 530 })).crsGap).toBe(20);
  });

  it('is null when the draw is missing, even with a score', () => {
    const model = deriveMissionControl(makeExecutingData({ latestDraw: null }));
    expect(model.crsGap).toBeNull();
    expect(model.latestDraw).toBeNull();
  });

  it('is null when the score is missing, even with a draw', () => {
    expect(deriveMissionControl(makeExecutingData({ crsScore: null })).crsGap).toBeNull();
  });

  it('never leaks a gap or draw into discovering, even when both exist upstream', () => {
    const model = deriveMissionControl(
      makeData({
        latestDraw: { cutoffScore: 510, drawDate: '2026-06-20', drawType: 'FSW', invitationsIssued: 3000 },
      })
    );
    expect(model.state).toBe('discovering');
    expect(model.crsGap).toBeNull();
    expect(model.latestDraw).toBeNull();
    expect(model.crsScore).toBe(470);
  });
});

// ─── Levers ───────────────────────────────────────────────────────────────────

describe('deriveMissionControl — levers', () => {
  it('returns no levers when the breakdown is not computable', () => {
    expect(deriveMissionControl(makeExecutingData({ crsBreakdown: null })).levers).toEqual([]);
  });

  it('ranks provincial nomination first with its documented +600 when no nomination exists', () => {
    const levers = deriveMissionControl(makeExecutingData()).levers;
    expect(levers[0]?.id).toBe('provincial-nomination');
    expect(levers[0]?.deltaLabel).toBe('+600 pts');
    expect(levers).toHaveLength(3);
  });

  it('omits provincial nomination when additional points already include one', () => {
    const levers = deriveMissionControl(
      makeExecutingData({
        crsBreakdown: { age: 100, education: 120, language: 80, experience: 40, transferability: 50, additional: 600 },
      })
    ).levers;
    expect(levers.some((l) => l.id === 'provincial-nomination')).toBe(false);
  });

  it('shows the computed counterfactual delta on the language lever', () => {
    const levers = deriveMissionControl(makeExecutingData({ crsClbPlusOneDelta: 18 })).levers;
    const language = levers.find((l) => l.id === 'language');
    expect(language?.deltaLabel).toBe('+18 pts per +1 CLB');
  });

  it('presents the language lever qualitatively when no delta is computable', () => {
    const levers = deriveMissionControl(makeExecutingData({ crsClbPlusOneDelta: null })).levers;
    const language = levers.find((l) => l.id === 'language');
    expect(language).toBeDefined();
    expect(language?.deltaLabel).toBeNull();
  });

  it('keeps the computed language lever in the list when headroom alone would drop it', () => {
    // Language headroom (12) ranks fourth behind PNP (600), experience (62),
    // and education (25) — but its computed +12 delta must still surface.
    const levers = deriveMissionControl(
      makeExecutingData({
        crsBreakdown: { age: 100, education: 125, language: 124, experience: 8, transferability: 75, additional: 0 },
        crsClbPlusOneDelta: 12,
      })
    ).levers;
    expect(levers).toHaveLength(3);
    const language = levers.find((l) => l.id === 'language');
    expect(language?.deltaLabel).toBe('+12 pts per +1 CLB');
  });

  it('lets pure headroom ranking drop a language lever with no computable delta', () => {
    const levers = deriveMissionControl(
      makeExecutingData({
        crsBreakdown: { age: 100, education: 125, language: 124, experience: 8, transferability: 75, additional: 0 },
        crsClbPlusOneDelta: null,
      })
    ).levers;
    expect(levers).toHaveLength(3);
    expect(levers.some((l) => l.id === 'language')).toBe(false);
  });

  it('only ever labels deltas that are computed or documented', () => {
    const levers = deriveMissionControl(makeExecutingData({ crsClbPlusOneDelta: null })).levers;
    for (const lever of levers) {
      if (lever.deltaLabel !== null) {
        expect(lever.id).toBe('provincial-nomination');
      }
    }
  });
});

// ─── Actions ──────────────────────────────────────────────────────────────────

describe('deriveMissionControl — actions', () => {
  it('is a single start-matcher deep link in discovering', () => {
    const actions = deriveMissionControl(makeData()).actions;
    expect(actions).toHaveLength(1);
    expect(actions[0]?.id).toBe('start-matcher');
    expect(actions[0]?.href).toBe('/dashboard/pathways');
  });

  it('surfaces profile gaps above everything else in executing', () => {
    const actions = deriveMissionControl(
      makeExecutingData({
        incompleteFields: ['clb_speaking', 'clb_writing'],
        crsScore: 490,
        selectedPathwaySteps: [],
        applicationSteps: [makeStep(1, 'current')],
      })
    ).actions;
    expect(actions[0]?.id).toBe('profile-gaps');
    expect(actions[0]?.href).toBe('/dashboard/profile');
    expect(actions[0]?.description).toContain('2 profile details are missing');
  });

  it('inserts the top lever as an action when below the cutoff, never when above', () => {
    const below = deriveMissionControl(makeExecutingData({ crsScore: 490 })).actions;
    expect(below.some((a) => a.id === 'lever-provincial-nomination')).toBe(true);

    const above = deriveMissionControl(makeExecutingData({ crsScore: 530 })).actions;
    expect(above.some((a) => a.id.startsWith('lever-'))).toBe(false);
  });

  it('surfaces the top lever as the next best action when the program has no live cutoff', () => {
    const actions = deriveMissionControl(
      makeExecutingData({
        latestDraw: null,
        applicationSteps: [makeStep(1, 'complete'), makeStep(2, 'current')],
      })
    ).actions;
    expect(actions[0]?.id).toBe('lever-provincial-nomination');
    expect(actions[0]?.deltaLabel).toBe('+600 pts');
    const stepIndex = actions.findIndex((a) => a.id === 'current-step');
    expect(stepIndex).toBeGreaterThan(0);
  });

  it('ranks the roadmap step below the lever whenever the candidate is below the cutoff', () => {
    const actions = deriveMissionControl(
      makeExecutingData({
        crsScore: 490,
        applicationSteps: [makeStep(1, 'current')],
      })
    ).actions;
    const leverIndex = actions.findIndex((a) => a.id.startsWith('lever-'));
    const stepIndex = actions.findIndex((a) => a.id === 'current-step');
    expect(leverIndex).toBeGreaterThanOrEqual(0);
    expect(stepIndex).toBeGreaterThan(leverIndex);
  });

  it('never emits an upload action even on the no-live-cutoff lever path', () => {
    const actions = deriveMissionControl(
      makeExecutingData({
        latestDraw: null,
        applicationSteps: [makeStep(1, 'current')],
        documents: [{ id: 'd1', name: 'Passport', isMandatory: true, status: 'pending' }],
        recommendations: [
          { id: 'eca', label: 'Get your ECA', description: 'Foreign credentials recognised in Canada.', impactLabel: '' },
        ],
      })
    ).actions;
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      expect(action.label.toLowerCase()).not.toContain('upload');
      expect(action.description.toLowerCase()).not.toContain('upload');
    }
  });

  it('links the current roadmap step to the Application tab', () => {
    const actions = deriveMissionControl(
      makeExecutingData({ applicationSteps: [makeStep(1, 'complete'), makeStep(2, 'current')] })
    ).actions;
    const step = actions.find((a) => a.id === 'current-step');
    expect(step?.label).toBe('Step 2');
    expect(step?.href).toBe('/dashboard/application');
  });

  it('includes starting an ECA as a real-world action with no invented delta', () => {
    const actions = deriveMissionControl(
      makeExecutingData({
        recommendations: [
          { id: 'eca', label: 'Get your ECA', description: 'Foreign credentials recognised in Canada.', impactLabel: '+15 pts' },
        ],
      })
    ).actions;
    const eca = actions.find((a) => a.id === 'eca');
    expect(eca).toBeDefined();
    expect(eca?.href).toBeNull();
    expect(eca?.deltaLabel).toBeNull();
  });

  it('never emits an upload-to-Pathways action', () => {
    const actions = deriveMissionControl(
      makeExecutingData({
        incompleteFields: ['clb_speaking'],
        crsScore: 490,
        applicationSteps: [makeStep(1, 'current')],
        documents: [{ id: 'd1', name: 'Passport', isMandatory: true, status: 'pending' }],
        recommendations: [
          { id: 'eca', label: 'Get your ECA', description: 'Foreign credentials recognised in Canada.', impactLabel: '' },
        ],
      })
    ).actions;
    for (const action of actions) {
      expect(action.label.toLowerCase()).not.toContain('upload');
      expect(action.description.toLowerCase()).not.toContain('upload');
    }
  });
});

// ─── Pathway asks ─────────────────────────────────────────────────────────────

describe('deriveMissionControl — pathway asks', () => {
  it('lists requirement names mandatory-first with no count semantics', () => {
    const model = deriveMissionControl(
      makeExecutingData({
        documents: [
          { id: 'd1', name: 'IELTS results', isMandatory: false, status: 'pending' },
          { id: 'd2', name: 'Passport', isMandatory: true, status: 'pending' },
        ],
      })
    );
    expect(model.pathwayAsks).toEqual([
      { name: 'Passport', isMandatory: true },
      { name: 'IELTS results', isMandatory: false },
    ]);
  });

  it('is empty outside executing', () => {
    const model = deriveMissionControl(
      makeData({ documents: [{ id: 'd1', name: 'Passport', isMandatory: true, status: 'pending' }] })
    );
    expect(model.pathwayAsks).toEqual([]);
  });
});
