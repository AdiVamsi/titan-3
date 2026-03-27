/**
 * BullMQ Worker for Job Applications
 * Executes adapter.apply() or adapter.prefill() for jobs
 * Creates Application record and updates job status
 * Logs application attempts
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { getAdapterById } from '../adapters/registry';
import { ApplyMethod } from '../lib/types';

const prisma = new PrismaClient();

// Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
});

interface ApplyJobData {
  jobId: string;
  method: 'apply' | 'prefill';
  adapterId?: string;
  resumePath?: string;
  coverLetter?: string;
  answers?: Record<string, string>;
}

/**
 * Process apply jobs
 */
const worker = new Worker<ApplyJobData>(
  'apply-queue',
  async (job: Job<ApplyJobData>) => {
    console.log(`[APPLY] Processing job ${job.id}`, job.data);

    try {
      const { jobId, method, adapterId, resumePath, coverLetter, answers } = job.data;

      // Fetch job record
      const jobRecord = await prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!jobRecord) {
        throw new Error(`Job not found: ${jobId}`);
      }

      console.log(
        `[APPLY] ${method.toUpperCase()} for job: ${jobRecord.title} at ${jobRecord.companyName}`,
      );

      // Determine which adapter to use
      let adapter;
      if (adapterId) {
        adapter = getAdapterById(adapterId);
        if (!adapter) {
          throw new Error(`Unknown adapter: ${adapterId}`);
        }
      } else if (jobRecord.adapterId) {
        adapter = getAdapterById(jobRecord.adapterId);
      } else {
        throw new Error(`No adapter specified and job has no adapter`);
      }

      // Convert job to NormalizedJob format for adapter
      const normalizedJob = {
        id: jobRecord.id,
        sourceType: jobRecord.sourceType,
        sourceId: jobRecord.externalId || jobRecord.id,
        sourceUrl: jobRecord.sourceUrl,
        title: jobRecord.title,
        company: jobRecord.companyName,
        description: '',
        location: jobRecord.location || '',
        workplaceType: jobRecord.workplaceType,
        remote: jobRecord.workplaceType === 'REMOTE',
        requiredSkills: [],
        preferredSkills: [],
        sponsorshipRequired: false,
        sponsorshipRisk: jobRecord.sponsorshipRisk as any,
        applyMethod: ApplyMethod.ADAPTER_SUBMIT,
        applyUrl: jobRecord.sourceUrl,
        rawContent: '',
        ingestedAt: jobRecord.createdAt,
        lastUpdated: jobRecord.updatedAt,
      };

      let applyResult;
      let applicationStatus = 'PENDING';

      if (method === 'apply') {
        if (!adapter.capabilities.canApply) {
          throw new Error(`Adapter ${adapter.id} does not support applying`);
        }

        const payload = {
          resumePath: resumePath || '/path/to/resume.pdf',
          coverLetter: coverLetter,
          answers: answers || {},
          workAuth: 'Authorized to work in the U.S. under STEM OPT',
        };

        applyResult = await adapter.apply(normalizedJob, payload);
      } else if (method === 'prefill') {
        if (!adapter.capabilities.canPrefill) {
          throw new Error(`Adapter ${adapter.id} does not support prefill`);
        }

        if (!adapter.prefill) {
          throw new Error(`Adapter ${adapter.id} does not have prefill implementation`);
        }

        const prefillResult = await adapter.prefill(normalizedJob);
        applyResult = {
          success: prefillResult.success,
          method: ApplyMethod.BROWSER_PREFILL,
          message: prefillResult.message,
          data: {
            applicationUrl: prefillResult.url,
            timestamp: new Date(),
          },
        };
      } else {
        throw new Error(`Unknown apply method: ${method}`);
      }

      if (applyResult.success) {
        applicationStatus = 'SUBMITTED';
      } else {
        applicationStatus = 'FAILED';
      }

      // Create or update application record
      const application = await prisma.application.upsert({
        where: { jobId },
        create: {
          jobId,
          method: applyResult.method,
          appliedAt: applyResult.success ? new Date() : null,
          adapterUsed: adapter.id,
          submissionPayload: {
            method,
            resumePath,
            coverLetter,
            answers,
          },
          responseData: applyResult.data || null,
          status: applicationStatus,
          notes: applyResult.message,
        },
        update: {
          method: applyResult.method,
          appliedAt: applyResult.success ? new Date() : null,
          adapterUsed: adapter.id,
          submissionPayload: {
            method,
            resumePath,
            coverLetter,
            answers,
          },
          responseData: applyResult.data || null,
          status: applicationStatus,
          notes: applyResult.message,
        },
      });

      // Update job status
      let jobStatus = 'APPLIED';
      if (!applyResult.success) {
        jobStatus = 'APPLY_FAILED';
      }

      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: {
          status: jobStatus,
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          jobId,
          action: applyResult.success ? 'APPLIED' : 'APPLY_FAILED',
          actor: 'APPLY_WORKER',
          details: {
            method,
            adapter: adapter.id,
            success: applyResult.success,
            message: applyResult.message,
            applicationUrl: applyResult.data?.applicationUrl,
          },
        },
      });

      console.log(`[APPLY] ${method} completed for ${jobId}:`, {
        success: applyResult.success,
        message: applyResult.message,
      });

      return {
        success: applyResult.success,
        jobId,
        applicationId: application.id,
        method,
        adapter: adapter.id,
        message: applyResult.message,
      };
    } catch (error) {
      console.error('[APPLY] Worker error:', error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 1,
  },
);

// Event handlers
worker.on('completed', (job) => {
  console.log(`[APPLY] Job completed: ${job.id}`);
});

worker.on('failed', (job, error) => {
  console.error(`[APPLY] Job failed: ${job?.id}`, error);
});

worker.on('error', (error) => {
  console.error('[APPLY] Worker error:', error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[APPLY] Shutting down worker...');
  await worker.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
});

export default worker;
