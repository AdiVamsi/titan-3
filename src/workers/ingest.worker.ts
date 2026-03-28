/**
 * BullMQ Worker for Job Ingestion
 * Processes ingestion jobs from adapters or manual entry
 * Stages raw jobs, applies deterministic intake filters,
 * and only creates Job records for ACCEPT decisions.
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { getAdapterById } from '../adapters/registry';
import { manualAdapter, ManualIngestConfig } from '../adapters/manual';
import { IngestConfig } from '../adapters/base';
import { buildStagedJobInputFromNormalizedJob, stageAndProcessIncomingJob } from '../lib/job-intake';
import { NormalizedJob } from '../lib/types';

const prisma = new PrismaClient();

// Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
});

interface IngestJobData {
  // Adapter-based ingestion
  adapterId?: string;
  config?: IngestConfig;
  // Manual ingestion
  manual?: boolean;
  url?: string;
  rawText?: string;
  title?: string;
  companyName?: string;
  location?: string;
}

/**
 * Process ingestion jobs
 */
const worker = new Worker<IngestJobData>(
  'ingest-queue',
  async (job: Job<IngestJobData>) => {
    console.log(`[INGEST] Processing job ${job.id}`, job.data);

    try {
      let normalizedJobs: NormalizedJob[] = [];
      let source = '';

      // Handle manual ingestion
      if (job.data.manual) {
        console.log('[INGEST] Processing manual ingestion');
        source = 'manual';

        if (!job.data.title || !job.data.companyName || !job.data.rawText || !job.data.url) {
          throw new Error('Manual ingestion requires title, companyName, rawText, and url');
        }

        const manualConfig: ManualIngestConfig = {
          title: job.data.title,
          company: job.data.companyName,
          description: job.data.rawText,
          url: job.data.url,
          location: job.data.location,
        };

        const result = await manualAdapter.ingest(manualConfig);
        if (result.errors.length > 0) {
          throw new Error(`Manual ingestion errors: ${result.errors.join(', ')}`);
        }
        normalizedJobs = result.jobs;
      } else if (job.data.adapterId && job.data.config) {
        // Handle adapter-based ingestion
        console.log(`[INGEST] Processing adapter ingestion: ${job.data.adapterId}`);
        source = job.data.adapterId;

        const adapter = getAdapterById(job.data.adapterId);
        if (!adapter) {
          throw new Error(`Unknown adapter: ${job.data.adapterId}`);
        }

        if (!adapter.capabilities.canIngest) {
          throw new Error(`Adapter ${job.data.adapterId} does not support ingestion`);
        }

        const result = await adapter.ingest(job.data.config);
        if (result.errors.length > 0) {
          console.warn(`[INGEST] Adapter errors:`, result.errors);
        }
        normalizedJobs = result.jobs;
      } else {
        throw new Error('Ingestion job must specify either adapterId+config or manual=true');
      }

      if (normalizedJobs.length === 0) {
        console.warn(`[INGEST] No jobs returned from ${source}`);
        return {
          success: true,
          jobsProcessed: 0,
          jobsCreated: 0,
          jobsDuplicated: 0,
          source,
        };
      }

      // Stage, filter, and selectively accept jobs
      let stagedCount = 0;
      let jobsCreated = 0;
      let jobsDuplicated = 0;
      let reviewCount = 0;
      let rejectedCount = 0;

      for (const normalizedJob of normalizedJobs) {
        try {
          const result = await stageAndProcessIncomingJob(
            prisma,
            buildStagedJobInputFromNormalizedJob(normalizedJob, source),
          );

          stagedCount++;

          if (result.stagedJob.dedupeReason) {
            jobsDuplicated++;
          }

          switch (result.stagedJob.filterDecision) {
            case 'ACCEPT':
              if (result.acceptedJob) {
                console.log(
                  `[INGEST] Accepted job: ${result.acceptedJob.id} - ${normalizedJob.title} at ${normalizedJob.company}`,
                );
                jobsCreated++;
              } else {
                rejectedCount++;
              }
              break;
            case 'REVIEW':
              reviewCount++;
              break;
            case 'REJECT':
            default:
              rejectedCount++;
              break;
          }
        } catch (jobError) {
          console.error(
            `[INGEST] Error processing individual job: ${normalizedJob.title}`,
            jobError,
          );
        }
      }

      const result = {
        success: true,
        jobsProcessed: normalizedJobs.length,
        stagedCount,
        jobsCreated,
        reviewCount,
        rejectedCount,
        jobsDuplicated,
        source,
      };

      console.log(`[INGEST] Completed: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      console.error('[INGEST] Worker error:', error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 2,
  },
);

// Event handlers
worker.on('completed', (job) => {
  console.log(`[INGEST] Job completed: ${job.id}`);
});

worker.on('failed', (job, error) => {
  console.error(`[INGEST] Job failed: ${job?.id}`, error);
});

worker.on('error', (error) => {
  console.error('[INGEST] Worker error:', error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[INGEST] Shutting down worker...');
  await worker.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
});

export default worker;
