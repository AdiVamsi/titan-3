/**
 * Follow-up endpoints
 * POST /api/jobs/[id]/followup - Create a follow-up
 * PATCH /api/jobs/[id]/followup - Update follow-up (mark complete)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { serializeJob } from '@/lib/job-contract';
import { z } from 'zod';

const CreateFollowUpSchema = z.object({
  dueDate: z.string().datetime(),
  action: z.string().min(1, 'Action is required'),
  notes: z.string().optional(),
});

const UpdateFollowUpSchema = z.object({
  followUpId: z.string(),
  completed: z.boolean(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { dueDate, action, notes } = CreateFollowUpSchema.parse(body);

    // Verify job exists
    const job = await prisma.job.findUnique({
      where: { id: params.id },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Create follow-up
    const followUp = await prisma.followUp.create({
      data: {
        jobId: params.id,
        dueDate: new Date(dueDate),
        action,
        notes: notes || null,
      },
    });

    // Update job status to FOLLOW_UP
    const updatedJob = await prisma.job.update({
      where: { id: params.id },
      data: { status: 'FOLLOW_UP' },
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
        jobId: params.id,
        action: 'CREATE_FOLLOWUP',
        actor: 'system',
        details: {
          followUpId: followUp.id,
          action,
          dueDate,
        },
      },
    });

    const serializedJob = serializeJob(updatedJob);

    return NextResponse.json(
      {
        message: 'Follow-up created successfully',
        job: serializedJob,
        data: {
          followUp,
          job: serializedJob,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Create Follow-up Error]', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create follow-up' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { followUpId, completed } = UpdateFollowUpSchema.parse(body);

    // Verify follow-up exists and belongs to this job
    const followUp = await prisma.followUp.findUnique({
      where: { id: followUpId },
    });

    if (!followUp || followUp.jobId !== params.id) {
      return NextResponse.json(
        { error: 'Follow-up not found' },
        { status: 404 }
      );
    }

    // Update follow-up
    const updatedFollowUp = await prisma.followUp.update({
      where: { id: followUpId },
      data: {
        completed,
        completedAt: completed ? new Date() : null,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        jobId: params.id,
        action: 'UPDATE_FOLLOWUP',
        actor: 'system',
        details: {
          followUpId,
          completed,
        },
      },
    });

    return NextResponse.json(
      {
        message: 'Follow-up updated successfully',
        data: updatedFollowUp,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Update Follow-up Error]', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update follow-up' },
      { status: 500 }
    );
  }
}
