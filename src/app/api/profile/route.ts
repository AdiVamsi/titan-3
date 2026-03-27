import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import prisma from '@/lib/db';
import {
  buildFallbackCandidateProfile,
  getActiveCandidateProfile,
  mapResumeProfile,
} from '@/lib/candidate-profile';

const ProfilePatchSchema = z.object({
  fullName: z.string().trim().min(1).optional().nullable(),
  headline: z.string().trim().min(1).optional().nullable(),
  summary: z.string().trim().min(1).optional().nullable(),
  currentRole: z.string().trim().min(1).optional().nullable(),
  yearsExperience: z.coerce.number().min(0).max(60).optional(),
  skills: z.array(z.string().trim().min(1)).optional(),
  projects: z.array(z.string().trim().min(1)).optional(),
  targetRoles: z.array(z.string().trim().min(1)).optional(),
  preferredLocations: z.array(z.string().trim().min(1)).optional(),
  remotePreference: z.string().trim().min(1).optional().nullable(),
  workAuthorizationNote: z.string().trim().min(1).optional(),
  rawResumeText: z.string().trim().min(1).optional().nullable(),
  notes: z.string().trim().min(1).optional().nullable(),
});

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function splitSkills(skills: string[]) {
  const normalized = uniqueStrings(skills);
  const aiKeywords = [
    'ai',
    'genai',
    'llm',
    'rag',
    'embedding',
    'vector',
    'agent',
    'prompt',
    'langchain',
    'openai',
    'claude',
    'machine learning',
  ];
  const backendKeywords = [
    'python',
    'java',
    'javascript',
    'sql',
    'rest',
    'microservice',
    'spring',
    'node',
    'express',
    'postgres',
    'mysql',
    'prisma',
    'aws',
    'api',
  ];

  return {
    aiSkills: normalized.filter((skill) =>
      aiKeywords.some((keyword) => skill.toLowerCase().includes(keyword)),
    ),
    backendSkills: normalized.filter((skill) =>
      backendKeywords.some((keyword) => skill.toLowerCase().includes(keyword)),
    ),
  };
}

function buildProfileData(
  input: z.infer<typeof ProfilePatchSchema>,
  current = buildFallbackCandidateProfile(),
) {
  const fullName =
    input.fullName !== undefined ? input.fullName : current.fullName || null;
  const headline =
    input.headline !== undefined ? input.headline : current.headline || null;
  const summary =
    input.summary !== undefined ? input.summary : current.summary || null;
  const currentRole =
    input.currentRole !== undefined ? input.currentRole : current.currentRole || null;
  const experienceYears =
    input.yearsExperience !== undefined
      ? input.yearsExperience
      : current.experienceYears;
  const skills = uniqueStrings(
    input.skills !== undefined ? input.skills : current.skills || [],
  );
  const projects = uniqueStrings(
    input.projects !== undefined ? input.projects : current.projects || [],
  );
  const targetTitles = uniqueStrings(
    input.targetRoles !== undefined ? input.targetRoles : current.targetTitles,
  );
  const preferredLocations = uniqueStrings(
    input.preferredLocations !== undefined
      ? input.preferredLocations
      : current.preferredLocations || [],
  );
  const remotePreference =
    input.remotePreference !== undefined
      ? input.remotePreference
      : current.remotePreference || null;
  const workAuth = input.workAuthorizationNote || current.workAuth;
  const rawResumeText =
    input.rawResumeText !== undefined
      ? input.rawResumeText
      : current.rawResumeText || null;
  const notes = input.notes !== undefined ? input.notes : current.notes || null;
  const locationPref =
    preferredLocations.join(' | ') || current.locationPref || null;
  const { aiSkills, backendSkills } = splitSkills(skills);
  const coreSkills = uniqueStrings([
    ...backendSkills,
    ...skills.slice(0, 10),
  ]).slice(0, 16);
  const preferredSkills = uniqueStrings([
    ...aiSkills,
    ...skills.filter((skill) => !coreSkills.includes(skill)),
  ]).slice(0, 16);

  return {
    label: 'primary',
    fullName,
    headline,
    summary,
    currentRole,
    rawResumeText,
    skills,
    aiSkills,
    backendSkills,
    projects,
    targetTitles,
    coreSkills,
    preferredSkills,
    experienceYears,
    workAuth,
    locationPref,
    preferredLocations,
    remotePreference,
    notes,
  };
}

export async function GET() {
  try {
    const savedProfile = await prisma.resumeProfile.findUnique({
      where: { label: 'primary' },
    });
    const profile = await getActiveCandidateProfile(prisma);

    return NextResponse.json({
      profile,
      usingFallback: !savedProfile,
    });
  } catch (error) {
    console.error('[Get Profile Error]', error);
    return NextResponse.json(
      { error: 'Failed to load profile' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const input = ProfilePatchSchema.parse(await request.json());
    const existing = await prisma.resumeProfile.findUnique({
      where: { label: 'primary' },
    });
    const current = existing ? mapResumeProfile(existing) : buildFallbackCandidateProfile();
    const data = buildProfileData(input, current);

    const profile = await prisma.resumeProfile.upsert({
      where: { label: 'primary' },
      create: data,
      update: data,
    });

    return NextResponse.json({
      message: 'Profile saved',
      profile: mapResumeProfile(profile),
      usingFallback: false,
    });
  } catch (error) {
    console.error('[Patch Profile Error]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message || 'Invalid profile payload',
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to save profile' },
      { status: 500 },
    );
  }
}
