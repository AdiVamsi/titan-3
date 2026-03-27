/**
 * Jobs endpoints
 * GET /api/jobs - List jobs with filters and pagination
 * POST /api/jobs - Create a new job manually
 */

import { JobStatus, Prisma, SourceType, WorkplaceType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import prisma from '@/lib/db';
import {
  buildJobOrderBy,
  parseJobStatuses,
  parseSourceType,
  resolveJobSort,
  resolveSortOrder,
  serializeJob,
} from '@/lib/job-contract';

const ListJobsSchema = z.object({
  status: z.string().optional(),
  minScore: z.coerce.number().optional(),
  source: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

const CreateJobSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  companyName: z.string().min(1, 'Company name is required'),
  sourceUrl: z.string().url('Invalid source URL'),
  sourceType: z.nativeEnum(SourceType).default(SourceType.MANUAL),
  location: z.string().optional(),
  workplaceType: z.nativeEnum(WorkplaceType).optional(),
  salaryText: z.string().optional(),
  rawText: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const { status, minScore, source, search, page, limit, offset, sort, order } =
      ListJobsSchema.parse({
        status: searchParams.get('status') || undefined,
        minScore: searchParams.get('minScore') || undefined,
        source: searchParams.get('source') || undefined,
        search: searchParams.get('search') || undefined,
        page: searchParams.get('page') || undefined,
        limit: searchParams.get('limit') || '20',
        offset: searchParams.get('offset') || undefined,
        sort: searchParams.get('sort') || undefined,
        order: searchParams.get('order') || undefined,
      });

    const validStatuses = parseJobStatuses(status);
    const sourceType = parseSourceType(source);
    const sortKey = resolveJobSort(sort);
    const sortOrder = resolveSortOrder(order, sort);
    const effectiveOffset = offset ?? ((page ?? 1) - 1) * limit;

    const where: Prisma.JobWhereInput = {};

    if (validStatuses.length === 1) {
      where.status = validStatuses[0];
    } else if (validStatuses.length > 1) {
      where.status = { in: validStatuses };
    }

    if (minScore !== undefined) {
      where.fitScore = { gte: minScore };
    }

    if (sourceType) {
      where.sourceType = sourceType;
    }

    if (search?.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { companyName: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          content: true,
          score: true,
          packet: true,
          application: true,
          followUps: {
            orderBy: { dueDate: 'asc' },
          },
        },
        orderBy: buildJobOrderBy(sortKey, sortOrder),
        skip: effectiveOffset,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    return NextResponse.json(
      {
        items: jobs.map(serializeJob),
        total,
        limit,
        offset: effectiveOffset,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[Jobs List Error]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          message: 'Invalid query parameters',
          details: error.errors,
          items: [],
          total: 0,
          limit: 20,
          offset: 0,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to list jobs',
        message: 'Failed to list jobs',
        items: [],
        total: 0,
        limit: 20,
        offset: 0,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      title,
      companyName,
      sourceUrl,
      sourceType,
      location,
      workplaceType,
      salaryText,
      rawText,
    } = CreateJobSchema.parse(body);

    const job = await prisma.job.create({
      data: {
        title,
        companyName,
        sourceUrl,
        sourceType,
        location: location?.trim() || null,
        workplaceType: workplaceType || WorkplaceType.UNKNOWN,
        salaryText: salaryText?.trim() || null,
        status: JobStatus.NEW,
        content: rawText
          ? {
              create: {
                rawText,
                requirements: [],
                niceToHaves: [],
                responsibilities: [],
              },
            }
          : undefined,
      },
      include: {
        content: true,
        score: true,
        packet: true,
        application: true,
        followUps: {
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    const serializedJob = serializeJob(job);

    return NextResponse.json(
      {
        message: 'Job created successfully',
        job: serializedJob,
        data: serializedJob,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[Create Job Error]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          message: 'Invalid request body',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to create job', message: 'Failed to create job' },
      { status: 500 },
    );
  }
}
