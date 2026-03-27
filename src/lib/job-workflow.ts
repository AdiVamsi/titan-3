import { Prisma, PrismaClient, SponsorshipRisk } from '@prisma/client';

import { ActiveCandidateProfile, getActiveCandidateProfile } from '@/lib/candidate-profile';
import { scoreJob } from '@/lib/scoring';

type WorkflowClient = PrismaClient | Prisma.TransactionClient;

export const WORKFLOW_JOB_INCLUDE = {
  content: true,
  score: true,
  packet: true,
  application: true,
  followUps: {
    orderBy: { dueDate: 'asc' as const },
  },
};

function normalizeJobText(rawText: string) {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isLikelyHeading(line: string) {
  return /^[A-Za-z][A-Za-z /&-]{2,60}:?$/.test(line.trim());
}

function normalizeListItem(line: string) {
  return line.replace(/^[-*]\s*/, '').trim();
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.filter(Boolean))).slice(0, 12);
}

function extractSectionItems(text: string, headings: string[]) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const normalizedHeadings = headings.map((heading) => heading.toLowerCase());
  const items: string[] = [];
  let collecting = false;

  for (const line of lines) {
    const normalizedLine = line.toLowerCase().replace(/:$/, '');

    if (normalizedHeadings.includes(normalizedLine)) {
      collecting = true;
      continue;
    }

    if (collecting && isLikelyHeading(line)) {
      break;
    }

    if (!collecting) {
      continue;
    }

    const item = normalizeListItem(line);
    if (item) {
      items.push(item);
    }
  }

  return uniqueItems(items);
}

function deriveSponsorshipRisk(score: number): SponsorshipRisk {
  if (score >= 80) return 'SAFE';
  if (score >= 60) return 'LIKELY_SAFE';
  if (score >= 40) return 'UNCERTAIN';
  if (score >= 20) return 'RISKY';
  return 'BLOCKED';
}

export async function normalizeAndScoreJob(
  db: WorkflowClient,
  jobId: string,
  candidateProfile?: ActiveCandidateProfile,
) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: {
      content: true,
    },
  });

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  if (!job.content) {
    throw new Error(`Job content not found for job: ${jobId}`);
  }

  const cleanedText = normalizeJobText(job.content.rawText || '');
  const requirements = extractSectionItems(cleanedText, [
    'requirements',
    'qualifications',
    'minimum qualifications',
    'what you bring',
    'must have',
  ]);
  const responsibilities = extractSectionItems(cleanedText, [
    'responsibilities',
    'what you will do',
    'what youll do',
    'what you\'ll do',
    'day to day',
  ]);
  const niceToHaves = extractSectionItems(cleanedText, [
    'nice to have',
    'preferred qualifications',
    'preferred',
    'bonus',
    'bonus points',
  ]);

  await db.jobContent.update({
    where: { jobId },
    data: {
      cleanedText,
      requirements,
      responsibilities,
      niceToHaves,
    },
  });

  await db.job.update({
    where: { id: jobId },
    data: {
      status: 'NORMALIZED',
    },
  });

  await db.auditLog.create({
    data: {
      jobId,
      action: 'NORMALIZE_JOB',
      actor: 'system',
      details: {
        requirements: requirements.length,
        responsibilities: responsibilities.length,
        niceToHaves: niceToHaves.length,
      },
    },
  });

  const profile = candidateProfile || (await getActiveCandidateProfile(db));
  const scoreBreakdown = scoreJob(
    job.title,
    job.companyName,
    job.location,
    job.salaryText,
    cleanedText || job.content.rawText || '',
    profile,
  );

  await db.jobScore.upsert({
    where: { jobId },
    create: {
      jobId,
      roleFamily: scoreBreakdown.roleFamily,
      familyConfidence: scoreBreakdown.familyConfidence,
      titleFit: scoreBreakdown.titleFit,
      skillsFit: scoreBreakdown.skillsFit,
      seniorityFit: scoreBreakdown.seniorityFit,
      aiRelevance: scoreBreakdown.aiRelevance,
      backendRelevance: scoreBreakdown.backendRelevance,
      locationFit: scoreBreakdown.locationFit,
      sponsorshipRisk: scoreBreakdown.sponsorshipRisk,
      priorityScore: scoreBreakdown.priorityScore,
      positionabilityScore: scoreBreakdown.positionabilityScore,
      riskLevel: scoreBreakdown.riskLevel,
      pursuitRecommendation: scoreBreakdown.pursuitRecommendation,
      overallScore: scoreBreakdown.overallScore,
      rationale: scoreBreakdown.rationale,
      strategicRationale: scoreBreakdown.strategicRationale,
      positionabilityNote: scoreBreakdown.positionabilityNote,
      riskFlags: scoreBreakdown.riskFlags,
      matchedSkills: scoreBreakdown.matchedSkills,
      missingSkills: scoreBreakdown.missingSkills,
      matchedCoreSkills: scoreBreakdown.matchedCoreSkills,
      missingCoreSkills: scoreBreakdown.missingCoreSkills,
      missingSecondarySkills: scoreBreakdown.missingSecondarySkills,
      incidentalMismatches: scoreBreakdown.incidentalMismatches,
      keywordGaps: scoreBreakdown.keywordGaps,
      relevantProjects: scoreBreakdown.relevantProjects,
      risks: scoreBreakdown.risks,
    },
    update: {
      roleFamily: scoreBreakdown.roleFamily,
      familyConfidence: scoreBreakdown.familyConfidence,
      titleFit: scoreBreakdown.titleFit,
      skillsFit: scoreBreakdown.skillsFit,
      seniorityFit: scoreBreakdown.seniorityFit,
      aiRelevance: scoreBreakdown.aiRelevance,
      backendRelevance: scoreBreakdown.backendRelevance,
      locationFit: scoreBreakdown.locationFit,
      sponsorshipRisk: scoreBreakdown.sponsorshipRisk,
      priorityScore: scoreBreakdown.priorityScore,
      positionabilityScore: scoreBreakdown.positionabilityScore,
      riskLevel: scoreBreakdown.riskLevel,
      pursuitRecommendation: scoreBreakdown.pursuitRecommendation,
      overallScore: scoreBreakdown.overallScore,
      rationale: scoreBreakdown.rationale,
      strategicRationale: scoreBreakdown.strategicRationale,
      positionabilityNote: scoreBreakdown.positionabilityNote,
      riskFlags: scoreBreakdown.riskFlags,
      matchedSkills: scoreBreakdown.matchedSkills,
      missingSkills: scoreBreakdown.missingSkills,
      matchedCoreSkills: scoreBreakdown.matchedCoreSkills,
      missingCoreSkills: scoreBreakdown.missingCoreSkills,
      missingSecondarySkills: scoreBreakdown.missingSecondarySkills,
      incidentalMismatches: scoreBreakdown.incidentalMismatches,
      keywordGaps: scoreBreakdown.keywordGaps,
      relevantProjects: scoreBreakdown.relevantProjects,
      risks: scoreBreakdown.risks,
    },
  });

  await db.job.update({
    where: { id: jobId },
    data: {
      fitScore: scoreBreakdown.overallScore,
      sponsorshipRisk: deriveSponsorshipRisk(scoreBreakdown.sponsorshipRisk),
      status: 'SCORED',
    },
  });

  await db.auditLog.create({
    data: {
      jobId,
      action: 'SCORE_JOB',
      actor: 'system',
      details: {
        overallScore: scoreBreakdown.overallScore,
      },
    },
  });

  const updatedJob = await db.job.findUnique({
    where: { id: jobId },
    include: WORKFLOW_JOB_INCLUDE,
  });

  if (!updatedJob) {
    throw new Error(`Scored job not found: ${jobId}`);
  }

  return {
    job: updatedJob,
    scoreBreakdown,
  };
}
