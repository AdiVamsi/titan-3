/**
 * Single job endpoints
 * GET /api/jobs/[id] - Get job with all relations
 * PATCH /api/jobs/[id] - Update job fields
 * DELETE /api/jobs/[id] - Soft-delete by archiving
 */

import { ApplyMethod, JobStatus, Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import prisma from '@/lib/db';
import {
  parseJobStatus,
  parseSponsorshipRisk,
  serializeJob,
} from '@/lib/job-contract';

const UpdateJobSchema = z.object({
  status: z.string().optional(),
  notes: z.string().optional(),
  sponsorshipRisk: z.string().optional(),
  location: z.string().optional(),
});

const jobInclude = {
  content: true,
  score: true,
  packet: true,
  application: true,
  followUps: {
    orderBy: { dueDate: 'asc' as const },
  },
  auditLogs: true,
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: jobInclude,
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const serializedJob = serializeJob(job);

    return NextResponse.json(
      { job: serializedJob, data: serializedJob },
      { status: 200 },
    );
  } catch (error) {
    console.error('[Get Job Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch job', message: 'Failed to fetch job' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    const { status, notes, sponsorshipRisk, location } = UpdateJobSchema.parse(body);

    const parsedStatus = status === undefined ? undefined : parseJobStatus(status);
    const parsedSponsorshipRisk =
      sponsorshipRisk === undefined
        ? undefined
        : parseSponsorshipRisk(sponsorshipRisk);

    if (status !== undefined && !parsedStatus) {
      return NextResponse.json(
        { error: `Invalid status '${status}'`, message: 'Invalid status' },
        { status: 400 },
      );
    }

    if (sponsorshipRisk !== undefined && !parsedSponsorshipRisk) {
      return NextResponse.json(
        {
          error: `Invalid sponsorship risk '${sponsorshipRisk}'`,
          message: 'Invalid sponsorship risk',
        },
        { status: 400 },
      );
    }

    const existingJob = await prisma.job.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existingJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const job = await prisma.$transaction(async (tx) => {
      const updateData: Prisma.JobUpdateInput = {};

      if (parsedStatus) {
        updateData.status = parsedStatus;
      }

      if (parsedSponsorshipRisk) {
        updateData.sponsorshipRisk = parsedSponsorshipRisk;
      }

      if (location !== undefined) {
        updateData.location = location.trim() || null;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.job.update({
          where: { id: params.id },
          data: updateData,
        });
      }

      if (
        parsedStatus === JobStatus.APPLIED ||
        parsedStatus === JobStatus.REVIEW_OPENED
      ) {
        await tx.application.upsert({
          where: { jobId: params.id },
          update: {
            method:
              parsedStatus === JobStatus.REVIEW_OPENED
                ? ApplyMethod.BROWSER_PREFILL
                : ApplyMethod.MANUAL_OPEN,
            appliedAt: new Date(),
            status: 'PENDING',
          },
          create: {
            jobId: params.id,
            method:
              parsedStatus === JobStatus.REVIEW_OPENED
                ? ApplyMethod.BROWSER_PREFILL
                : ApplyMethod.MANUAL_OPEN,
            appliedAt: new Date(),
            adapterUsed: null,
            status: 'PENDING',
          },
        });
      }

      if (notes !== undefined) {
        await tx.application.upsert({
          where: { jobId: params.id },
          update: {
            notes: notes.trim() || null,
          },
          create: {
            jobId: params.id,
            method: ApplyMethod.NOT_ATTEMPTED,
            appliedAt: null,
            adapterUsed: null,
            status: 'PENDING',
            notes: notes.trim() || null,
          },
        });
      }

      if (parsedStatus && parsedStatus !== existingJob.status) {
        await tx.auditLog.create({
          data: {
            jobId: params.id,
            action: 'UPDATE_JOB_STATUS',
            actor: 'system',
            details: {
              previousStatus: existingJob.status,
              nextStatus: parsedStatus,
            },
          },
        });
      }

      return tx.job.findUnique({
        where: { id: params.id },
        include: jobInclude,
      });
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const serializedJob = serializeJob(job);

    return NextResponse.json(
      {
        message: 'Job updated successfully',
        job: serializedJob,
        data: serializedJob,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[Update Job Error]', error);

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
      { error: 'Failed to update job', message: 'Failed to update job' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const job = await prisma.job.update({
      where: { id: params.id },
      data: { status: JobStatus.ARCHIVED },
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
        message: 'Job archived successfully',
        job: serializedJob,
        data: serializedJob,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[Delete Job Error]', error);
    return NextResponse.json(
      { error: 'Failed to delete job', message: 'Failed to delete job' },
      { status: 500 },
    );
  }
}
