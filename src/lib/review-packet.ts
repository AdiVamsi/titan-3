import { SponsorshipRisk } from '@prisma/client';

import { ActiveCandidateProfile, buildFallbackCandidateProfile } from '@/lib/candidate-profile';
import { CANDIDATE_PROFILE } from '@/lib/profile';
import { analyzeSponsorshipSignals } from '@/lib/scoring';

export type PacketJobInput = {
  title: string;
  companyName: string;
  sourceUrl: string;
  sponsorshipRisk: SponsorshipRisk;
  content: {
    rawText: string;
    cleanedText: string | null;
    requirements: string[];
    niceToHaves: string[];
    responsibilities: string[];
  } | null;
  score: {
    roleFamily?: string | null;
    priorityScore?: number;
    positionabilityScore?: number;
    riskLevel?: string | null;
    riskFlags?: string[];
    pursuitRecommendation?: string | null;
    titleFit: number;
    skillsFit: number;
    seniorityFit: number;
    aiRelevance: number;
    backendRelevance: number;
    locationFit: number;
    sponsorshipRisk: number;
    overallScore: number;
    rationale: string;
    matchedSkills: string[];
    missingSkills: string[];
    matchedCoreSkills?: string[];
    missingCoreSkills?: string[];
    missingSecondarySkills?: string[];
    keywordGaps: string[];
    strategicRationale?: string;
    positionabilityNote?: string;
    risks?: string[];
  } | null;
};

export type PacketPayload = {
  resumeEmphasis: string[];
  summaryRewrite: string;
  bulletsToHighlight: string[];
  outreachDraft: string;
  interviewPrepBullets: string[];
  risks: string[];
  whyApply: string;
  sponsorNotes: string;
};

function formatRecommendationLabel(recommendation?: string | null) {
  switch (recommendation) {
    case 'STRONG_CURRENT_FIT':
      return 'Strong Current Fit';
    case 'ADJACENT_HIGH_PRIORITY':
      return 'Good Adjacent Fit';
    case 'STRETCH_BUT_CREDIBLE':
      return 'Stretch';
    case 'LOW_PRIORITY':
    case 'NOT_WORTH_PURSUING':
      return 'Skip';
    default:
      return 'Needs Review';
  }
}

function isSkipLikeRecommendation(recommendation?: string | null) {
  return recommendation === 'LOW_PRIORITY' || recommendation === 'NOT_WORTH_PURSUING';
}

function isHighRiskLevel(riskLevel?: string | null) {
  return (riskLevel || '').toUpperCase() === 'HIGH';
}

function cleanList(items: Array<string | null | undefined>, limit = 6) {
  return Array.from(
    new Set(
      items
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item)),
    ),
  ).slice(0, limit);
}

function safeText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function normalizePacketPayload(
  payload: Partial<PacketPayload> | null | undefined,
  fallbackWorkAuth = CANDIDATE_PROFILE.workAuth,
): PacketPayload {
  return {
    resumeEmphasis: cleanList(payload?.resumeEmphasis || []),
    summaryRewrite: safeText(payload?.summaryRewrite, 'No summary available yet.'),
    bulletsToHighlight: cleanList(payload?.bulletsToHighlight || []),
    outreachDraft: safeText(
      payload?.outreachDraft,
      'No outreach draft available yet.',
    ),
    interviewPrepBullets: cleanList(payload?.interviewPrepBullets || []),
    risks: cleanList(payload?.risks || []),
    whyApply: safeText(payload?.whyApply, 'No match summary available yet.'),
    sponsorNotes: safeText(
      payload?.sponsorNotes,
      fallbackWorkAuth,
    ),
  };
}

export function buildDeterministicPacket(
  job: PacketJobInput,
  candidateProfile: ActiveCandidateProfile = buildFallbackCandidateProfile(),
): PacketPayload {
  const recommendationLabel = formatRecommendationLabel(job.score?.pursuitRecommendation);
  const isSkipLike = isSkipLikeRecommendation(job.score?.pursuitRecommendation);
  const isHighRisk = isHighRiskLevel(job.score?.riskLevel);
  const requiresCautionaryRewrite = isSkipLike || isHighRisk;
  const matchedSkills = cleanList(
    job.score?.matchedCoreSkills || job.score?.matchedSkills || [],
    5,
  );
  const missingSkills = cleanList(
    job.score?.missingCoreSkills || job.score?.missingSkills || [],
    4,
  );
  const missingSecondary = cleanList(job.score?.missingSecondarySkills || [], 4);
  const keywordGaps = cleanList(job.score?.keywordGaps || [], 3);
  const responsibilities = cleanList(job.content?.responsibilities || [], 4);
  const requirements = cleanList(job.content?.requirements || [], 4);
  const sponsorshipAnalysis = analyzeSponsorshipSignals(
    job.content?.cleanedText || job.content?.rawText || '',
    candidateProfile,
  );
  const sponsorshipRiskText =
    sponsorshipAnalysis.negativeSignals.length > 0
      ? `The posting includes restrictive sponsorship language (${sponsorshipAnalysis.negativeSignals
          .slice(0, 2)
          .join(', ')}), so this role needs caution.`
      : 'No explicit sponsorship blocker was detected in the deterministic pass.';
  const coreRiskFlags = cleanList(job.score?.riskFlags || [], 4);
  const riskHeadline =
    job.score?.riskLevel
      ? `Current risk level is ${job.score.riskLevel}.`
      : 'Risk level is not available yet.';
  const scoreSnapshot = `Current scoring says fit ${job.score?.overallScore ?? 0}/100, priority ${job.score?.priorityScore ?? 0}/100, and positionability ${job.score?.positionabilityScore ?? 0}/100.`;
  const realismGuidance =
    isSkipLike
      ? 'This role is not worth prioritizing right now.'
      : isHighRisk
      ? 'This role carries a high-risk profile and needs caution before investing serious effort.'
      : recommendationLabel === 'Stretch'
      ? 'This role is only worth selective effort and needs careful judgment.'
      : recommendationLabel === 'Good Adjacent Fit'
      ? 'This role is believable as an adjacent move if positioned carefully.'
      : 'This role is a realistic current target.';
  const scoreAlignedReason = requiresCautionaryRewrite
    ? cleanList([
        job.score?.positionabilityNote || null,
        coreRiskFlags[0] ? `Main blocker: ${coreRiskFlags[0]}.` : null,
        missingSkills.length > 0
          ? `Largest gaps are ${missingSkills.join(', ')}.`
          : null,
        keywordGaps.length > 0
          ? `The JD also leans on ${keywordGaps.join(', ')}.`
          : null,
      ], 2).join(' ')
    : job.score?.strategicRationale ||
      job.score?.rationale ||
      'The role shows usable overlap with the current profile.';

  const whyApply = [
    `${job.title} at ${job.companyName} sits in the ${job.score?.roleFamily || 'current target'} lane.`,
    scoreSnapshot,
    `Current recommendation: ${recommendationLabel}.`,
    realismGuidance,
    scoreAlignedReason,
  ].join(' ');

  const summaryRewrite = [
    `${recommendationLabel} for ${job.title} at ${job.companyName}.`,
    scoreSnapshot,
    requiresCautionaryRewrite
      ? matchedSkills.length > 0
        ? `There is some overlap in ${matchedSkills.join(', ')}, but it does not offset the current realism and risk profile.`
        : 'The current profile does not show enough direct overlap to justify active pursuit.'
      : matchedSkills.length > 0
      ? `Lean into ${matchedSkills.join(', ')} when positioning experience.`
      : 'Lean into transferable backend and AI experience when positioning experience.',
    requiresCautionaryRewrite && coreRiskFlags.length > 0
      ? `Primary concerns: ${coreRiskFlags.join(', ')}.`
      : missingSkills.length > 0
      ? `Be ready to address gaps around ${missingSkills.join(', ')}.`
      : missingSecondary.length > 0
      ? `Most missing items look secondary rather than role-defining: ${missingSecondary.join(', ')}.`
      : 'No major keyword gaps surfaced from the deterministic pass.',
    riskHeadline,
  ].join(' ');

  const bulletsToHighlight = cleanList([
    ...matchedSkills.map((skill) => `Highlight hands-on work with ${skill}.`),
    ...requirements.map((requirement) => `Tie prior work to: ${requirement}`),
  ]);

  const outreachDraft = [
    isSkipLike
      ? `This is not a priority outreach target right now because the current scoring recommends ${recommendationLabel.toLowerCase()}.`
      : isHighRisk
      ? `This role should stay a cautious outreach target because the current scoring flags a high-risk profile.`
      : `Hi ${job.companyName} team, I’m interested in the ${job.title} role.`,
    requiresCautionaryRewrite
      ? `If pursued at all, the application would need to address ${coreRiskFlags.slice(0, 2).join(' and ') || 'the current realism concerns'} directly.`
      : matchedSkills.length > 0
      ? `My background lines up well with ${matchedSkills.slice(0, 3).join(', ')} and adjacent backend/AI work.`
      : 'My background lines up well with backend and applied AI engineering work.',
    isSkipLike
      ? 'Spend limited time here unless there is a special strategic reason to pursue it.'
      : isHighRisk
      ? 'Keep any outreach timeboxed until the risk items are resolved.'
      : `I’d welcome the chance to discuss fit for the role and the problems your team is solving.`,
  ].join(' ');

  const interviewPrepBullets = cleanList([
    ...responsibilities.map(
      (responsibility) => `Prepare a concrete example relevant to: ${responsibility}`,
    ),
    ...missingSkills.map(
      (skill) => `Have a concise plan for ramping on ${skill}.`,
    ),
    ...missingSecondary.map(
      (skill) => `Frame ${skill} as a grow-into stack item, not a blocker.`,
    ),
    ...keywordGaps.map(
      (gap) => `Expect questions about ${gap} if it matters for the role.`,
    ),
    ...(coreRiskFlags || []).map(
      (flag) => `Be ready to address this risk directly: ${flag}.`,
    ),
    isSkipLike
      ? 'Do not invest full interview prep time here unless the opportunity has special strategic value.'
      : null,
    sponsorshipAnalysis.negativeSignals.length > 0
      ? 'Be ready to explain work authorization clearly and confirm whether future sponsorship would block the process.'
      : null,
  ]);

  const risks = cleanList([
    riskHeadline,
    ...coreRiskFlags,
    ...(job.score?.risks || []),
    ...missingSkills.map((skill) => `Missing or less explicit evidence for ${skill}.`),
    ...keywordGaps.map((gap) => `Posting references ${gap}, which may need explanation.`),
    sponsorshipAnalysis.negativeSignals.length > 0
      ? sponsorshipRiskText
      : null,
    job.sponsorshipRisk === 'RISKY' || job.sponsorshipRisk === 'BLOCKED'
      ? 'Work authorization language may need careful handling before investing time in this application.'
      : null,
  ]);

  return normalizePacketPayload({
    resumeEmphasis: matchedSkills,
    summaryRewrite,
    bulletsToHighlight,
    outreachDraft,
    interviewPrepBullets,
    risks,
    whyApply,
    sponsorNotes: `${candidateProfile.workAuth} ${sponsorshipRiskText}`.trim(),
  }, candidateProfile.workAuth);
}

export function alignPacketWithCurrentScore(
  packet: PacketPayload,
  job: PacketJobInput,
  candidateProfile: ActiveCandidateProfile = buildFallbackCandidateProfile(),
): PacketPayload {
  const deterministicPacket = buildDeterministicPacket(job, candidateProfile);

  return normalizePacketPayload(
    {
      ...packet,
      summaryRewrite: deterministicPacket.summaryRewrite,
      whyApply: deterministicPacket.whyApply,
      outreachDraft: deterministicPacket.outreachDraft,
      risks: deterministicPacket.risks,
      sponsorNotes: deterministicPacket.sponsorNotes,
    },
    candidateProfile.workAuth,
  );
}
