/**
 * BullMQ Worker for Job Ingestion
 * Processes ingestion jobs from adapters or manual entry
 * Creates Job and JobContent records in database
 * Handles deduplication by canonical URL
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { getAdapterById } from '../adapters/registry';
import { manualAdapter, ManualIngestConfig } from '../adapters/manual';
import { IngestConfig } from '../adapters/base';

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
      let normalizedJobs = [];
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

      // Process and store jobs
      let jobsCreated = 0;
      let jobsDuplicated = 0;

      for (const normalizedJob of normalizedJobs) {
        try {
          // Check for duplicates by canonical URL
          let canonicalUrl = normalizedJob.sourceUrl;

          // Normalize URL for deduplication (remove query params, fragments, etc.)
          try {
            const url = new URL(normalizedJob.sourceUrl);
            canonicalUrl = `${url.protocol}//${url.host}${url.pathname}`;
          } catch {
            // If URL parsing fails, use as-is
          }

          const existingJob = await prisma.job.findUnique({
            where: { canonicalUrl },
          });

          if (existingJob) {
            console.log(
              `[INGEST] Duplicate job detected: ${normalizedJob.title} at ${normalizedJob.company}`,
            );
            jobsDuplicated++;
            continue;
          }

          // Get or create company
          let company = await prisma.company.findUnique({
            where: { name: normalizedJob.company },
          });

          if (!company) {
            company = await prisma.company.create({
              data: {
                name: normalizedJob.company,
                domain: normalizedJob.companyUrl,
              },
            });
            console.log(`[INGEST] Created company: ${company.name}`);
          }

          // Create job record
          const createdJob = await prisma.job.create({
            data: {
              sourceType: normalizedJob.sourceType,
              sourceUrl: normalizedJob.sourceUrl,
              canonicalUrl,
              title: normalizedJob.title,
              companyName: normalizedJob.company,
              companyId: company.id,
              location: normalizedJob.location || null,
              workplaceType: normalizedJob.workplaceType,
              salaryText: null,
              adapterId: source,
              status: 'INGESTED',
              sponsorshipRisk: 'UNCERTAIN',
            },
          });

          // Create job content record
          await prisma.jobContent.create({
            data: {
              jobId: createdJob.id,
              rawText: normalizedJob.rawContent,
              requirements: normalizedJob.requiredSkills || [],
              niceToHaves: normalizedJob.preferredSkills || [],
              responsibilities: [],
            },
          });

          // Create audit log
          await prisma.auditLog.create({
            data: {
              jobId: createdJob.id,
              action: 'INGESTED',
              actor: 'INGEST_WORKER',
              details: {
                source,
                title: normalizedJob.title,
                company: normalizedJob.company,
              },
            },
          });

          console.log(
            `[INGEST] Created job: ${createdJob.id} - ${normalizedJob.title} at ${normalizedJob.company}`,
          );
          jobsCreated++;
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
        jobsCreated,
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
