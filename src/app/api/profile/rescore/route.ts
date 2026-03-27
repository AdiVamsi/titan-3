import { NextResponse } from 'next/server';

import prisma from '@/lib/db';
import { getActiveCandidateProfile } from '@/lib/candidate-profile';
import { normalizeAndScoreJob } from '@/lib/job-workflow';

export async function POST() {
  try {
    const profile = await getActiveCandidateProfile(prisma);
    const jobs = await prisma.job.findMany({
      where: {
        content: {
          isNot: null,
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    let rescored = 0;
    for (const job of jobs) {
      await normalizeAndScoreJob(prisma, job.id, profile);
      rescored += 1;
    }

    return NextResponse.json({
      message:
        rescored === 0
          ? 'No jobs with content were found to rescore.'
          : `Rescored ${rescored} job${rescored === 1 ? '' : 's'}.`,
      rescored,
    });
  } catch (error) {
    console.error('[Rescore Jobs Error]', error);
    return NextResponse.json(
      { error: 'Failed to rescore jobs' },
      { status: 500 },
    );
  }
}
