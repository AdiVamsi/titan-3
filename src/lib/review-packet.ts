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

  const whyApply = [
    `${job.title} at ${job.companyName} sits in the ${job.score?.roleFamily || 'current target'} lane and scored ${job.score?.overallScore ?? 0}/100 for direct fit.`,
    job.score?.strategicRationale || job.score?.rationale || 'The role shows usable overlap with the current profile.',
  ].join(' ');

  const summaryRewrite = [
    `Strong fit for ${job.title} at ${job.companyName}.`,
    matchedSkills.length > 0
      ? `Lean into ${matchedSkills.join(', ')} when positioning experience.`
      : 'Lean into transferable backend and AI experience when positioning experience.',
    missingSkills.length > 0
      ? `Be ready to address gaps around ${missingSkills.join(', ')}.`
      : missingSecondary.length > 0
      ? `Most missing items look secondary rather than role-defining: ${missingSecondary.join(', ')}.`
      : 'No major keyword gaps surfaced from the deterministic pass.',
  ].join(' ');

  const bulletsToHighlight = cleanList([
    ...matchedSkills.map((skill) => `Highlight hands-on work with ${skill}.`),
    ...requirements.map((requirement) => `Tie prior work to: ${requirement}`),
  ]);

  const outreachDraft = [
    `Hi ${job.companyName} team, I’m interested in the ${job.title} role.`,
    matchedSkills.length > 0
      ? `My background lines up well with ${matchedSkills.slice(0, 3).join(', ')} and adjacent backend/AI work.`
      : 'My background lines up well with backend and applied AI engineering work.',
    `I’d welcome the chance to discuss fit for the role and the problems your team is solving.`,
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
    sponsorshipAnalysis.negativeSignals.length > 0
      ? 'Be ready to explain work authorization clearly and confirm whether future sponsorship would block the process.'
      : null,
  ]);

  const risks = cleanList([
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
