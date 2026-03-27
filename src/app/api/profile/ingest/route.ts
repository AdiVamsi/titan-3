import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import prisma from '@/lib/db';
import { mapResumeProfile } from '@/lib/candidate-profile';
import { parseResumeProfile } from '@/lib/profile-ingest';

const ProfileIngestSchema = z.object({
  resumeText: z.string().trim().min(1, 'Resume text is required'),
});

export async function POST(request: NextRequest) {
  try {
    const { resumeText } = ProfileIngestSchema.parse(await request.json());
    const parsedProfile = parseResumeProfile(resumeText);

    const profile = await prisma.resumeProfile.upsert({
      where: { label: 'primary' },
      create: parsedProfile,
      update: parsedProfile,
    });

    return NextResponse.json({
      message: 'Profile extracted and saved',
      profile: mapResumeProfile(profile),
      usingFallback: false,
    });
  } catch (error) {
    console.error('[Ingest Profile Error]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message || 'Resume text is required',
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to ingest profile' },
      { status: 500 },
    );
  }
}
