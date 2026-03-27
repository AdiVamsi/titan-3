import { Prisma, PrismaClient, ResumeProfile } from '@prisma/client';

import { CANDIDATE_PROFILE } from '@/lib/profile';
import { ScoringProfile } from '@/lib/scoring';

type ProfileClient = PrismaClient | Prisma.TransactionClient;

export type ActiveCandidateProfile = ScoringProfile & {
  id?: string;
  label: string;
  fullName?: string | null;
  headline?: string | null;
  summary?: string | null;
  currentRole?: string | null;
  rawResumeText?: string | null;
  skills: string[];
  projects: string[];
  preferredLocations: string[];
  remotePreference?: string | null;
  notes?: string | null;
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export function buildFallbackCandidateProfile(): ActiveCandidateProfile {
  return {
    label: 'primary',
    fullName: null,
    headline: null,
    summary: null,
    currentRole: null,
    rawResumeText: null,
    skills: uniqueStrings([
      ...CANDIDATE_PROFILE.coreSkills,
      ...CANDIDATE_PROFILE.preferredSkills,
      ...CANDIDATE_PROFILE.aiSkills,
      ...CANDIDATE_PROFILE.backendSkills,
    ]),
    aiSkills: uniqueStrings(CANDIDATE_PROFILE.aiSkills),
    backendSkills: uniqueStrings(CANDIDATE_PROFILE.backendSkills),
    projects: [],
    targetTitles: uniqueStrings(CANDIDATE_PROFILE.targetTitles),
    coreSkills: uniqueStrings(CANDIDATE_PROFILE.coreSkills),
    preferredSkills: uniqueStrings(CANDIDATE_PROFILE.preferredSkills),
    experienceYears: CANDIDATE_PROFILE.experienceYears,
    seniorityLevel: CANDIDATE_PROFILE.seniorityLevel,
    workAuth: CANDIDATE_PROFILE.workAuth,
    locationPref: CANDIDATE_PROFILE.locationPref,
    preferredLocations: [],
    remotePreference: null,
    notes: null,
  };
}

export function mapResumeProfile(profile: ResumeProfile): ActiveCandidateProfile {
  const fallback = buildFallbackCandidateProfile();

  return {
    ...fallback,
    id: profile.id,
    label: profile.label,
    fullName: profile.fullName,
    headline: profile.headline,
    summary: profile.summary,
    currentRole: profile.currentRole,
    rawResumeText: profile.rawResumeText,
    skills: uniqueStrings([
      ...profile.skills,
      ...profile.coreSkills,
      ...profile.preferredSkills,
      ...profile.aiSkills,
      ...profile.backendSkills,
    ]),
    aiSkills: uniqueStrings(profile.aiSkills),
    backendSkills: uniqueStrings(profile.backendSkills),
    projects: uniqueStrings(profile.projects),
    targetTitles: uniqueStrings(profile.targetTitles),
    coreSkills: uniqueStrings(profile.coreSkills),
    preferredSkills: uniqueStrings(profile.preferredSkills),
    experienceYears: profile.experienceYears,
    seniorityLevel:
      profile.experienceYears >= 7
        ? 'senior'
        : profile.experienceYears >= 3
        ? 'mid'
        : 'junior',
    workAuth: profile.workAuth,
    locationPref: profile.locationPref || fallback.locationPref,
    preferredLocations: uniqueStrings(profile.preferredLocations),
    remotePreference: profile.remotePreference,
    notes: profile.notes,
  };
}

export async function getActiveCandidateProfile(
  db: ProfileClient,
): Promise<ActiveCandidateProfile> {
  const profile =
    (await db.resumeProfile.findUnique({
      where: { label: 'primary' },
    })) ||
    (await db.resumeProfile.findFirst({
      orderBy: { updatedAt: 'desc' },
    }));

  return profile ? mapResumeProfile(profile) : buildFallbackCandidateProfile();
}
