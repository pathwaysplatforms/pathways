import { CRS_FACTOR_CAPS } from '@/lib/crs-estimate';
import type {
  DashboardData,
  EnrichedApplicationStep,
  LatestDraw,
} from './types';

/** High-level dashboard mode; intentionally coarser than DashboardState. */
export type MissionControlState = 'onboarding' | 'discovering' | 'executing';

/** Ordered journey phases shown in the awareness strip. */
export type JourneyPhaseId =
  | 'profile'
  | 'eligibility'
  | 'pathway'
  | 'documents'
  | 'application'
  | 'submitted';

/** Display order and labels for the journey phase strip. */
export const JOURNEY_PHASES: ReadonlyArray<{ id: JourneyPhaseId; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'pathway', label: 'Pathway' },
  { id: 'documents', label: 'Documents' },
  { id: 'application', label: 'Application' },
  { id: 'submitted', label: 'Submitted' },
];

/** A CRS improvement lever ranked by remaining factor headroom. */
export interface CrsLever {
  id: string;
  label: string;
  description: string;
  /** Computed or IRCC-documented delta (e.g. "+600 pts"); null = present qualitatively, never invent a number. */
  deltaLabel: string | null;
}

/** One entry in the ranked next-best-action queue. */
export interface MissionAction {
  id: string;
  label: string;
  description: string;
  /** In-app deep link; null for purely real-world actions (e.g. starting an ECA). */
  href: string | null;
  deltaLabel: string | null;
}

/** A document the pathway asks for — awareness only, no owed-count semantics. */
export interface PathwayAsk {
  name: string;
  isMandatory: boolean;
}

/** Everything the mission-control dashboard renders, derived from DashboardData. */
export interface MissionControlModel {
  state: MissionControlState;
  firstName: string;
  pathwayTitle: string | null;
  processingTime: string | null;
  crsScore: number | null;
  /** Latest same-stream draw; null outside executing so no cutoff ever renders early. */
  latestDraw: LatestDraw | null;
  /** crsScore − cutoff (positive = above); null unless executing with both values present. */
  crsGap: number | null;
  /** Top improvement levers, highest headroom first (executing only). */
  levers: CrsLever[];
  /** Ranked action queue; index 0 is the surfaced next best action. */
  actions: MissionAction[];
  journeyPhase: JourneyPhaseId;
  /** "What this pathway asks for" reference list, mandatory items first. */
  pathwayAsks: PathwayAsk[];
}

/**
 * Blocking × impact rank constants for the executing-state action queue.
 * Higher = surfaced first. Profile gaps block estimate/match quality (3×3);
 * a CRS lever blocks the invitation itself whenever the candidate is below
 * the live cutoff — or has no live cutoff at all (3×2); the current roadmap
 * step advances the application (id 5); an unstarted ECA is a
 * long-lead-time real-world dependency (2×2).
 */
const ACTION_RANK = {
  profileGaps: 9,
  crsLever: 6,
  currentStep: 5,
  eca: 4,
} as const;

function deriveState(data: DashboardData): MissionControlState {
  if (data.onboardingStatus !== 'complete') return 'onboarding';
  const committed = data.applicationId !== null || data.selectedPathwaySlug !== null;
  return committed ? 'executing' : 'discovering';
}

function deriveJourneyPhase(data: DashboardData, state: MissionControlState): JourneyPhaseId {
  if (state === 'onboarding') return 'profile';
  if (state === 'discovering') return 'pathway';
  if (data.applicationSubmittedAt !== null) return 'submitted';
  if (data.applicationId !== null) return 'application';
  // Committed via selected_pathway_slug only — gathering what the pathway asks for.
  return 'documents';
}

function deriveLevers(data: DashboardData): CrsLever[] {
  const breakdown = data.crsBreakdown;
  if (breakdown === null) return [];

  const recById = new Map(data.recommendations.map((r) => [r.id, r]));
  const candidates: Array<CrsLever & { headroom: number }> = [];

  // Provincial nomination is a documented flat +600 (IRCC); additional < 600
  // means no nomination is present. The only lever with an inherent number.
  if (breakdown.additional < 600) {
    candidates.push({
      id: 'provincial-nomination',
      label: 'Pursue a provincial nomination',
      description: 'A provincial nominee certificate adds 600 CRS points — the largest single boost available.',
      deltaLabel: '+600 pts',
      headroom: 600,
    });
  }

  const languageHeadroom = CRS_FACTOR_CAPS.language - breakdown.language;
  if (languageHeadroom > 0) {
    candidates.push({
      id: 'language',
      label: 'Raise your language scores',
      description: 'Higher CLB levels lift your language and skill-transferability points together.',
      deltaLabel:
        data.crsClbPlusOneDelta !== null ? `+${data.crsClbPlusOneDelta} pts per +1 CLB` : null,
      headroom: languageHeadroom,
    });
  }

  const educationHeadroom = CRS_FACTOR_CAPS.education - breakdown.education;
  if (educationHeadroom > 0) {
    const eca = recById.get('eca');
    candidates.push({
      id: 'education',
      label: eca?.label ?? 'Strengthen your education credentials',
      description: eca?.description ?? 'Recognised credentials increase your education points.',
      deltaLabel: null,
      headroom: educationHeadroom,
    });
  }

  const experienceHeadroom = CRS_FACTOR_CAPS.experience - breakdown.experience;
  if (experienceHeadroom > 0) {
    const work = recById.get('canadian-work');
    candidates.push({
      id: 'experience',
      label: work?.label ?? 'Build more skilled work experience',
      description: work?.description ?? 'More skilled work experience raises your experience points.',
      deltaLabel: null,
      headroom: experienceHeadroom,
    });
  }

  return candidates
    .sort((a, b) => b.headroom - a.headroom)
    .slice(0, 3)
    .map(({ headroom: _headroom, ...lever }) => lever);
}

function currentStepOf(data: DashboardData): EnrichedApplicationStep | null {
  const steps =
    data.selectedPathwaySteps.length > 0 ? data.selectedPathwaySteps : data.applicationSteps;
  return steps.find((s) => s.status === 'current') ?? null;
}

function deriveActions(
  data: DashboardData,
  state: MissionControlState,
  levers: CrsLever[],
  crsGap: number | null
): MissionAction[] {
  if (state === 'onboarding') return [];

  if (state === 'discovering') {
    return [
      {
        id: 'start-matcher',
        label: 'Start the pathway matcher',
        description: 'Answer a few questions to narrow every pathway down to your strongest fits.',
        href: '/dashboard/pathways',
        deltaLabel: null,
      },
    ];
  }

  const ranked: Array<MissionAction & { rank: number }> = [];

  const missing = data.incompleteFields.length;
  if (missing > 0) {
    ranked.push({
      id: 'profile-gaps',
      label: 'Complete your profile',
      description: `${missing} profile ${missing === 1 ? 'detail is' : 'details are'} missing — filling them sharpens your CRS estimate and pathway match.`,
      href: '/dashboard/profile',
      deltaLabel: null,
      rank: ACTION_RANK.profileGaps,
    });
  }

  // Below the live cutoff, the top lever is what unblocks the invitation.
  // With no live cutoff (a stale or missing draw), the candidate cannot be
  // presumed invitable either, so the lever still outranks roadmap steps —
  // never fall through to "next step" as if the score were fine.
  const topLever = levers[0];
  if ((crsGap === null || crsGap < 0) && topLever !== undefined) {
    ranked.push({
      id: `lever-${topLever.id}`,
      label: topLever.label,
      description: topLever.description,
      href: null,
      deltaLabel: topLever.deltaLabel,
      rank: ACTION_RANK.crsLever,
    });
  }

  const currentStep = currentStepOf(data);
  if (currentStep !== null) {
    ranked.push({
      id: 'current-step',
      label: currentStep.label,
      description: currentStep.description,
      href: '/dashboard/application',
      deltaLabel: null,
      rank: ACTION_RANK.currentStep,
    });
  }

  // Real-world document dependency: starting an ECA (not an upload nag).
  // Skipped when the education lever already surfaced the same content.
  const eca = data.recommendations.find((r) => r.id === 'eca');
  if (eca !== undefined && !ranked.some((a) => a.id === 'lever-education')) {
    ranked.push({
      id: 'eca',
      label: 'Start your Educational Credential Assessment',
      description: eca.description,
      href: null,
      deltaLabel: null,
      rank: ACTION_RANK.eca,
    });
  }

  return ranked
    .sort((a, b) => b.rank - a.rank)
    .map(({ rank: _rank, ...action }) => action);
}

function derivePathwayAsks(data: DashboardData, state: MissionControlState): PathwayAsk[] {
  if (state !== 'executing') return [];
  return data.documents
    .map((d) => ({ name: d.name, isMandatory: d.isMandatory }))
    .sort((a, b) => Number(b.isMandatory) - Number(a.isMandatory));
}

/**
 * Derives the mission-control view model from an existing DashboardData payload.
 * Pure synthesis — performs no fetching and fabricates no numbers: every delta
 * is either counterfactually computed or IRCC-documented, otherwise omitted.
 */
export function deriveMissionControl(data: DashboardData): MissionControlModel {
  const state = deriveState(data);

  const pathwayTitle =
    state === 'executing' ? data.selectedPathwayTitle ?? data.pathwayTitle : null;
  const processingTime =
    state === 'executing'
      ? data.selectedPathwayProcessingTime ??
        (data.processingTimeMin !== null && data.processingTimeMax !== null
          ? `${data.processingTimeMin}–${data.processingTimeMax}`
          : null)
      : null;

  // Cutoff context is an executing-state concern; discovering shows a bare score.
  const latestDraw = state === 'executing' ? data.latestDraw : null;
  const crsGap =
    state === 'executing' && data.crsScore !== null && latestDraw !== null
      ? data.crsScore - latestDraw.cutoffScore
      : null;

  const levers = state === 'executing' ? deriveLevers(data) : [];

  return {
    state,
    firstName: data.firstName,
    pathwayTitle,
    processingTime,
    crsScore: state === 'onboarding' ? null : data.crsScore,
    latestDraw,
    crsGap,
    levers,
    actions: deriveActions(data, state, levers, crsGap),
    journeyPhase: deriveJourneyPhase(data, state),
    pathwayAsks: derivePathwayAsks(data, state),
  };
}
