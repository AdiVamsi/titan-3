import { Prisma, SourceType, StagedJobDecision, StagedJobStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import prisma from '@/lib/db';
import { stageAndProcessIncomingJob } from '@/lib/job-intake';
import { serializeJob } from '@/lib/job-contract';

const ListStagedJobsSchema = z.object({
  decision: z.nativeEnum(StagedJobDecision).optional(),
  state: z.nativeEnum(StagedJobStatus).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const CreateStagedJobSchema = z.object({
  sourceName: z.string().min(1).default('manual'),
  sourceType: z.nativeEnum(SourceType).optional(),
  sourceUrl: z.string().url(),
  canonicalUrl: z.string().url().optional(),
  externalId: z.string().optional(),
  title: z.string().min(1),
  companyName: z.string().min(1),
  location: z.string().optional(),
  rawText: z.string().min(1),
  postedAtRaw: z.string().optional(),
  workplaceTypeRaw: z.string().optional(),
  metadata: z.unknown().optional(),
  autoAccept: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const { decision, state, limit } = ListStagedJobsSchema.parse({
      decision: params.get('decision') || undefined,
      state: params.get('state') || undefined,
      limit: params.get('limit') || undefined,
    });

    const items = await prisma.stagedJob.findMany({
      where: {
        filterDecision: decision,
        pipelineState: state,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(
      {
        items,
        count: items.length,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[Staged Jobs List Error]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to load staged jobs' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = CreateStagedJobSchema.parse(await request.json());
    const result = await stageAndProcessIncomingJob(
      prisma,
      {
        sourceName: body.sourceName,
        sourceType: body.sourceType || SourceType.MANUAL,
        sourceUrl: body.sourceUrl,
        canonicalUrl: body.canonicalUrl || body.sourceUrl,
        externalId: body.externalId,
        rawTitle: body.title,
        rawCompany: body.companyName,
        rawLocation: body.location,
        rawDescription: body.rawText,
        postedAtRaw: body.postedAtRaw,
        workplaceTypeRaw: body.workplaceTypeRaw,
        metadata: body.metadata as Prisma.InputJsonValue | undefined,
      },
      {
        autoAccept: body.autoAccept,
      },
    );

    return NextResponse.json(
      {
        message: 'Staged job processed',
        stagedJob: result.stagedJob,
        acceptedJob: result.acceptedJob ? serializeJob(result.acceptedJob) : null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[Create Staged Job Error]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process staged job',
      },
      { status: 500 },
    );
  }
}
