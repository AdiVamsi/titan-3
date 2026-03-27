/**
 * Apply to job endpoint
 * POST /api/jobs/[id]/apply - Execute apply action
 */

import { NextRequest, NextResponse } from 'next/server';
import { JobStatus } from '@prisma/client';
import prisma from '@/lib/db';
import { getAdapterById } from '@/adapters/registry';
import { CANDIDATE_PROFILE } from '@/lib/profile';
import { serializeJob } from '@/lib/job-contract';
import { z } from 'zod';

const ApplySchema = z.object({
  resumePath: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request
      .json()
      .catch(() => ({}));
    const { resumePath } = ApplySchema.parse(body);

    // Fetch job with all relations
    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: {
        content: true,
        score: true,
        packet: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if job is in a state that can be applied to
    const applicableStatuses = ['READY', 'REVIEWING'];
    if (!applicableStatuses.includes(job.status)) {
      return NextResponse.json(
        {
          error: `Job must be in READY or REVIEWING status before applying. Current status: ${job.status}`,
        },
        { status: 400 }
      );
    }

    // Get adapter if available
    const adapter = job.adapterId ? getAdapterById(job.adapterId) : null;

    let method = 'MANUAL_OPEN';
    let applyResult: any = {
      success: false,
      method,
      sourceUrl: job.sourceUrl,
    };

    const adapterJobPayload = {
      id: job.id,
      sourceType: job.sourceType as any,
      sourceId: job.externalId || job.id,
      sourceUrl: job.sourceUrl,
      title: job.title,
      company: job.companyName,
      description: job.content?.rawText || '',
      location: job.location || '',
      workplaceType: job.workplaceType as any,
      remote: job.workplaceType === 'REMOTE',
      requiredSkills: [],
      preferredSkills: [],
      sponsorshipRequired: false,
      sponsorshipRisk: job.sponsorshipRisk as any,
      rawContent: job.content?.rawText || '',
      applyMethod: 'UNKNOWN' as any,
      ingestedAt: job.createdAt,
      lastUpdated: job.updatedAt,
    };

    // Determine apply method based on adapter capabilities
    if (adapter && adapter.capabilities.canApply) {
      try {
        // Use adapter to apply
        const payload = {
          resumePath: resumePath || '/path/to/resume.pdf',
          workAuth: CANDIDATE_PROFILE.workAuth,
        };
        const result = await adapter.apply(adapterJobPayload as any, payload);
        applyResult = result;
        method = 'ADAPTER_SUBMIT';
      } catch (adapterError) {
        console.error('[Adapter Apply Error]', adapterError);
        // Fall through to prefill or manual
      }
    }

    // Try prefill if adapter supports it and apply didn't work
    if (adapter && adapter.capabilities.canPrefill && !applyResult.success) {
      try {
        const prefillResult = await adapter.prefill?.(adapterJobPayload as any);
        applyResult = prefillResult;
        method = 'BROWSER_PREFILL';
      } catch (prefillError) {
        console.error('[Adapter Prefill Error]', prefillError);
        // Fall through to manual
      }
    }

    // Default to manual if no adapter or both failed
    if (!applyResult.success) {
      applyResult = {
        success: true,
        method: 'MANUAL_OPEN',
        message: 'Application link opened for manual submission',
        data: {
          sourceUrl: job.sourceUrl,
        },
      };
      method = 'MANUAL_OPEN';
    }

    // Create Application record
    const application = await prisma.application.upsert({
      where: { jobId: job.id },
      update: {
        method: method as any,
        appliedAt: new Date(),
        adapterUsed: adapter?.id || null,
        submissionPayload: applyResult.data || null,
        status: 'PENDING',
      },
      create: {
        jobId: job.id,
        method: method as any,
        appliedAt: new Date(),
        adapterUsed: adapter?.id || null,
        submissionPayload: applyResult.data || null,
        status: 'PENDING',
      },
    });

    // Update job status
    let newStatus: JobStatus = JobStatus.APPLIED;
    if (method === 'BROWSER_PREFILL') {
      newStatus = JobStatus.REVIEW_OPENED;
    } else if (!applyResult.success) {
      newStatus = JobStatus.APPLY_FAILED;
    }

    const updatedJob = await prisma.job.update({
      where: { id: job.id },
      data: { status: newStatus },
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        jobId: job.id,
        action: 'APPLY_JOB',
        actor: 'system',
        details: {
          method,
          success: applyResult.success,
          adapterId: adapter?.id || null,
        },
      },
    });

    const serializedJob = serializeJob(updatedJob);

    return NextResponse.json(
      {
        message: `Application submitted using ${method}`,
        method,
        job: serializedJob,
        data: {
          job: serializedJob,
          application,
          result: applyResult,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Apply Error]', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to apply to job' },
      { status: 500 }
    );
  }
}
