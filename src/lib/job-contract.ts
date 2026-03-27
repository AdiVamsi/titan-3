import { JobStatus, Prisma, SourceType, SponsorshipRisk } from '@prisma/client';

export type JobSortKey = 'createdAt' | 'fitScore' | 'appliedDate' | 'priorityScore';
export type DecisionState =
  | 'STRONG_FIT'
  | 'GOOD_ADJACENT_FIT'
  | 'STRETCH'
  | 'SKIP';

export const VALID_JOB_STATUSES = new Set(Object.values(JobStatus));
export const VALID_SOURCE_TYPES = new Set(Object.values(SourceType));
export const VALID_SPONSORSHIP_RISKS = new Set(Object.values(SponsorshipRisk));
const SPONSORSHIP_RISK_STATES = new Set(['RISKY', 'BLOCKED']);
const DECISION_STATE_LABELS: Record<DecisionState, string> = {
  STRONG_FIT: 'Strong Fit',
  GOOD_ADJACENT_FIT: 'Good Adjacent Fit',
  STRETCH: 'Stretch',
  SKIP: 'Skip',
};

type JobLike = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  externalId: string | null;
  sourceType: string;
  sourceUrl: string;
  canonicalUrl: string | null;
  adapterId: string | null;
  companyName: string;
  title: string;
  location: string | null;
  workplaceType: string;
  salaryText: string | null;
  postedAt: Date | null;
  status: string;
  sponsorshipRisk: string;
  fitScore: number | null;
  content?: {
    rawText: string;
    cleanedText: string | null;
    requirements: string[];
    niceToHaves: string[];
    responsibilities: string[];
  } | null;
  score?: {
    roleFamily?: string | null;
    familyConfidence?: number | null;
    titleFit: number;
    skillsFit: number;
    seniorityFit: number;
    aiRelevance: number;
    backendRelevance: number;
    locationFit: number;
    sponsorshipRisk: number;
    priorityScore?: number | null;
    positionabilityScore?: number | null;
    riskLevel?: string | null;
    pursuitRecommendation?: string | null;
    overallScore: number;
    rationale: string;
    strategicRationale?: string | null;
    positionabilityNote?: string | null;
    riskFlags?: string[];
    matchedSkills: string[];
    missingSkills: string[];
    matchedCoreSkills?: string[];
    missingCoreSkills?: string[];
    missingSecondarySkills?: string[];
    incidentalMismatches?: string[];
    keywordGaps: string[];
    relevantProjects: string[];
    risks: string[];
  } | null;
  packet?: {
    id: string;
    jobId: string;
    resumeEmphasis: string[];
    summaryRewrite: string | null;
    bulletsToHighlight: string[];
    outreachDraft: string | null;
    interviewPrepBullets: string[];
    risks: string[];
    whyApply: string | null;
    sponsorNotes: string | null;
    generatedBy: string;
    createdAt?: Date;
    updatedAt?: Date;
  } | null;
  application?: {
    id: string;
    method: string;
    appliedAt: Date | null;
    adapterUsed: string | null;
    status: string;
    notes: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  } | null;
  followUps?: Array<{
    id: string;
    action: string;
    dueDate: Date;
    completed: boolean;
    completedAt: Date | null;
    notes: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }> | null;
  [key: string]: unknown;
};

export function parseJobStatuses(rawStatus?: string | null): JobStatus[] {
  if (!rawStatus) return [];

  return rawStatus
    .split(',')
    .map((status) => status.trim().toUpperCase())
    .filter((status): status is JobStatus => VALID_JOB_STATUSES.has(status as JobStatus));
}

export function parseJobStatus(rawStatus?: string | null): JobStatus | undefined {
  return parseJobStatuses(rawStatus)[0];
}

export function parseSourceType(rawSource?: string | null): SourceType | undefined {
  if (!rawSource) return undefined;

  const normalizedSource = rawSource.trim().toUpperCase();
  if (!VALID_SOURCE_TYPES.has(normalizedSource as SourceType)) {
    return undefined;
  }

  return normalizedSource as SourceType;
}

export function parseSponsorshipRisk(
  rawRisk?: string | null,
): SponsorshipRisk | undefined {
  if (!rawRisk) return undefined;

  const normalizedRisk = rawRisk.trim().toUpperCase();
  if (!VALID_SPONSORSHIP_RISKS.has(normalizedRisk as SponsorshipRisk)) {
    return undefined;
  }

  return normalizedRisk as SponsorshipRisk;
}

export function resolveJobSort(rawSort?: string | null): JobSortKey {
  const normalizedSort = rawSort?.trim().toLowerCase() || '';

  if (normalizedSort.includes('fitscore')) return 'fitScore';
  if (normalizedSort.includes('applieddate')) return 'appliedDate';
  if (normalizedSort.includes('priorityscore')) return 'priorityScore';

  return 'createdAt';
}

export function resolveSortOrder(
  rawOrder?: string | null,
  rawSort?: string | null,
): Prisma.SortOrder {
  if (rawOrder === 'asc' || rawOrder === 'desc') {
    return rawOrder;
  }

  if (rawSort?.toLowerCase().includes(' asc')) {
    return 'asc';
  }

  return 'desc';
}

export function buildJobOrderBy(
  sortKey: JobSortKey,
  sortOrder: Prisma.SortOrder,
): Prisma.JobOrderByWithRelationInput[] {
  switch (sortKey) {
    case 'fitScore':
      return [{ fitScore: sortOrder }, { createdAt: 'desc' }];
    case 'priorityScore':
      return [
        { score: { priorityScore: sortOrder } } as Prisma.JobOrderByWithRelationInput,
        { fitScore: 'desc' },
        { createdAt: 'desc' },
      ];
    case 'appliedDate':
      return [
        { application: { appliedAt: sortOrder } } as Prisma.JobOrderByWithRelationInput,
        { createdAt: 'desc' },
      ];
    case 'createdAt':
    default:
      return [{ createdAt: sortOrder }];
  }
}

export function formatRecommendationLabel(recommendation?: string | null) {
  if (!recommendation) return null;

  if (recommendation === 'ADJACENT_HIGH_PRIORITY') {
    return 'Good Adjacent Fit';
  }

  if (recommendation === 'STRETCH_BUT_CREDIBLE') {
    return 'Stretch';
  }

  if (recommendation === 'LOW_PRIORITY' || recommendation === 'NOT_WORTH_PURSUING') {
    return 'Skip';
  }

  return recommendation
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function hasSponsorshipBlocker(job: JobLike) {
  if (SPONSORSHIP_RISK_STATES.has((job.sponsorshipRisk || '').toUpperCase())) {
    return true;
  }

  return (job.score?.riskFlags || []).some((flag) =>
    flag.toLowerCase().includes('sponsorship'),
  );
}

export function deriveDecisionState(job: JobLike): DecisionState {
  switch (job.score?.pursuitRecommendation) {
    case 'STRONG_CURRENT_FIT':
      return 'STRONG_FIT';
    case 'ADJACENT_HIGH_PRIORITY':
      return 'GOOD_ADJACENT_FIT';
    case 'STRETCH_BUT_CREDIBLE':
      return 'STRETCH';
    case 'LOW_PRIORITY':
    case 'NOT_WORTH_PURSUING':
      return 'SKIP';
    default:
      break;
  }

  if ((job.score?.priorityScore || 0) >= 60 || (job.fitScore || 0) >= 58) {
    return 'STRETCH';
  }

  return 'SKIP';
}

export function getDecisionStateLabel(decisionState: DecisionState) {
  return DECISION_STATE_LABELS[decisionState];
}

export function buildQueuePriorityScore(job: JobLike) {
  if (job.status === JobStatus.ARCHIVED || job.status === JobStatus.SKIPPED) {
    return -1000;
  }

  if (
    job.status === JobStatus.APPLIED ||
    job.status === JobStatus.REVIEW_OPENED ||
    job.status === JobStatus.FOLLOW_UP
  ) {
    return -500;
  }

  const fitScore = job.fitScore || job.score?.overallScore || 0;
  const priorityScore = job.score?.priorityScore || 0;
  const positionabilityScore = job.score?.positionabilityScore || 0;
  const riskLevel = (job.score?.riskLevel || '').toUpperCase();

  let score =
    priorityScore * 0.5 +
    positionabilityScore * 0.3 +
    fitScore * 0.2;

  switch (job.score?.pursuitRecommendation) {
    case 'STRONG_CURRENT_FIT':
      score += 18;
      break;
    case 'ADJACENT_HIGH_PRIORITY':
      score += 10;
      break;
    case 'STRETCH_BUT_CREDIBLE':
      score += 3;
      break;
    case 'LOW_PRIORITY':
      score -= 10;
      break;
    case 'NOT_WORTH_PURSUING':
      score -= 24;
      break;
    default:
      break;
  }

  switch (riskLevel) {
    case 'HIGH':
      score -= 22;
      break;
    case 'MEDIUM':
      score -= 8;
      break;
    default:
      break;
  }

  const sponsorshipRisk = (job.sponsorshipRisk || '').toUpperCase();

  switch (sponsorshipRisk) {
    case 'BLOCKED':
      score -= 28;
      break;
    case 'RISKY':
      score -= 18;
      break;
    case 'UNCERTAIN':
      score -= 6;
      break;
    default:
      break;
  }

  if (hasSponsorshipBlocker(job) && sponsorshipRisk !== 'BLOCKED' && sponsorshipRisk !== 'RISKY') {
    score -= 18;
  }

  switch (job.status) {
    case JobStatus.READY:
      score += 6;
      break;
    case JobStatus.REVIEWING:
      score += 3;
      break;
    default:
      break;
  }

  return Math.round(score);
}

export function serializeJob(job: JobLike) {
  const followUps = Array.isArray(job.followUps)
    ? [...job.followUps].sort(
        (left, right) => left.dueDate.getTime() - right.dueDate.getTime(),
      )
    : [];

  const nextFollowUp =
    followUps.find((followUp) => !followUp.completed) || followUps[0] || null;

  const reviewPacket = job.packet
    ? {
        ...job.packet,
        keyBullets: job.packet.bulletsToHighlight,
        interviewPrep: job.packet.interviewPrepBullets,
      }
    : null;

  const decisionState = deriveDecisionState(job);
  const recommendationLabel = formatRecommendationLabel(job.score?.pursuitRecommendation);
  const queuePriorityScore = buildQueuePriorityScore(job);

  const scoreDimensions = job.score
    ? [
        { name: 'Fit Score', score: job.score.overallScore, maxScore: 100 },
        {
          name: 'Priority Score',
          score: job.score.priorityScore || 0,
          maxScore: 100,
        },
        {
          name: 'Positionability',
          score: job.score.positionabilityScore || 0,
          maxScore: 100,
        },
        { name: 'Title / Family Fit', score: job.score.titleFit, maxScore: 100 },
        { name: 'Core Skill Fit', score: job.score.skillsFit, maxScore: 100 },
        { name: 'Seniority Fit', score: job.score.seniorityFit, maxScore: 100 },
        {
          name: 'Strategic Alignment',
          score: job.score.aiRelevance,
          maxScore: 100,
        },
        {
          name: 'Growth Potential',
          score: job.score.backendRelevance,
          maxScore: 100,
        },
        { name: 'Location Fit', score: job.score.locationFit, maxScore: 100 },
        {
          name: 'Sponsorship Risk',
          score: job.score.sponsorshipRisk,
          maxScore: 100,
        },
      ]
    : [];

  return {
    ...job,
    company: job.companyName,
    source: job.sourceType,
    salary: job.salaryText,
    appliedDate: job.application?.appliedAt || null,
    appliedMethod: job.application?.method || null,
    followUpDate: nextFollowUp?.dueDate || null,
    notes: job.application?.notes || null,
    rawJD: job.content?.rawText || null,
    cleanedJD: job.content?.cleanedText || null,
    requirements: job.content?.requirements || [],
    niceToHaves: job.content?.niceToHaves || [],
    responsibilities: job.content?.responsibilities || [],
    reviewPacket,
    scoreDimensions,
    roleFamily: job.score?.roleFamily || null,
    roleFamilyConfidence: job.score?.familyConfidence || null,
    priorityScore: job.score?.priorityScore || null,
    positionabilityScore: job.score?.positionabilityScore || null,
    riskLevel: job.score?.riskLevel || null,
    riskFlags: job.score?.riskFlags || [],
    pursuitRecommendation: job.score?.pursuitRecommendation || null,
    recommendationLabel,
    decisionState,
    decisionLabel: getDecisionStateLabel(decisionState),
    queuePriorityScore,
    scoreRationale: job.score?.strategicRationale || job.score?.rationale || null,
    strategicRationale: job.score?.strategicRationale || null,
    positionabilityNote: job.score?.positionabilityNote || null,
    matchedSkills: job.score?.matchedSkills || [],
    missingSkills: job.score?.missingSkills || [],
    matchedCoreSkills: job.score?.matchedCoreSkills || [],
    missingCoreSkills: job.score?.missingCoreSkills || [],
    missingSecondarySkills: job.score?.missingSecondarySkills || [],
    incidentalMismatches: job.score?.incidentalMismatches || [],
    keywordGaps: job.score?.keywordGaps || [],
    relevantProjects: job.score?.relevantProjects || [],
    scoreRisks: job.score?.risks || [],
    sponsorshipNotes: reviewPacket?.sponsorNotes || null,
  };
}
