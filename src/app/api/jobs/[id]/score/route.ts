/**
 * Score a job endpoint
 * POST /api/jobs/[id]/score - Score a job and save score
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { serializeJob } from '@/lib/job-contract';
import { normalizeAndScoreJob } from '@/lib/job-workflow';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await normalizeAndScoreJob(prisma, params.id);
    const serializedJob = serializeJob(result.job);

    return NextResponse.json(
      {
        message: 'Job scored successfully',
        job: serializedJob,
        data: {
          job: serializedJob,
          scoreBreakdown: result.scoreBreakdown,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Score Job Error]', error);
    return NextResponse.json(
      { error: 'Failed to score job' },
      { status: 500 }
    );
  }
}
