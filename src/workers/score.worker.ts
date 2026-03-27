/**
 * BullMQ Worker for Job Scoring
 * Fetches job and content from database
 * Runs scoring algorithm
 * Updates JobScore record and job.fitScore
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { scoreJob } from '../lib/scoring';

const prisma = new PrismaClient();

// Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
});

interface ScoreJobData {
  jobId: string;
}

/**
 * Process scoring jobs
 */
const worker = new Worker<ScoreJobData>(
  'score-queue',
  async (job: Job<ScoreJobData>) => {
    console.log(`[SCORE] Processing job ${job.id}`, job.data);

    try {
      const { jobId } = job.data;

      // Fetch job and content
      const jobRecord = await prisma.job.findUnique({
        where: { id: jobId },
        include: { content: true },
      });

      if (!jobRecord) {
        throw new Error(`Job not found: ${jobId}`);
      }

      if (!jobRecord.content) {
        throw new Error(`Job content not found for job: ${jobId}`);
      }

      console.log(`[SCORE] Scoring job: ${jobRecord.title} at ${jobRecord.companyName}`);

      // Run scoring algorithm
      const scoreBreakdown = scoreJob(
        jobRecord.title,
        jobRecord.companyName,
        jobRecord.location,
        jobRecord.salaryText,
        jobRecord.content.rawText,
      );

      // Upsert job score
      const jobScore = await prisma.jobScore.upsert({
        where: { jobId },
        create: {
          jobId,
          titleFit: scoreBreakdown.titleFit,
          skillsFit: scoreBreakdown.skillsFit,
          seniorityFit: scoreBreakdown.seniorityFit,
          aiRelevance: scoreBreakdown.aiRelevance,
          backendRelevance: scoreBreakdown.backendRelevance,
          locationFit: scoreBreakdown.locationFit,
          sponsorshipRisk: scoreBreakdown.sponsorshipRisk,
          overallScore: scoreBreakdown.overallScore,
          rationale: scoreBreakdown.rationale,
          matchedSkills: scoreBreakdown.matchedSkills,
          missingSkills: scoreBreakdown.missingSkills,
          keywordGaps: scoreBreakdown.keywordGaps,
        },
        update: {
          titleFit: scoreBreakdown.titleFit,
          skillsFit: scoreBreakdown.skillsFit,
          seniorityFit: scoreBreakdown.seniorityFit,
          aiRelevance: scoreBreakdown.aiRelevance,
          backendRelevance: scoreBreakdown.backendRelevance,
          locationFit: scoreBreakdown.locationFit,
          sponsorshipRisk: scoreBreakdown.sponsorshipRisk,
          overallScore: scoreBreakdown.overallScore,
          rationale: scoreBreakdown.rationale,
          matchedSkills: scoreBreakdown.matchedSkills,
          missingSkills: scoreBreakdown.missingSkills,
          keywordGaps: scoreBreakdown.keywordGaps,
        },
      });

      // Update job with fit score and status
      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: {
          fitScore: scoreBreakdown.overallScore,
          status: 'SCORED',
        },
      });

      // Determine sponsorship risk level
      let sponsorshipRisk = 'UNCERTAIN';
      if (scoreBreakdown.sponsorshipRisk >= 80) {
        sponsorshipRisk = 'SAFE';
      } else if (scoreBreakdown.sponsorshipRisk >= 60) {
        sponsorshipRisk = 'LIKELY_SAFE';
      } else if (scoreBreakdown.sponsorshipRisk >= 40) {
        sponsorshipRisk = 'UNCERTAIN';
      } else if (scoreBreakdown.sponsorshipRisk >= 20) {
        sponsorshipRisk = 'RISKY';
      } else {
        sponsorshipRisk = 'BLOCKED';
      }

      // Update sponsorship risk
      await prisma.job.update({
        where: { id: jobId },
        data: {
          sponsorshipRisk: sponsorshipRisk as any,
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          jobId,
          action: 'SCORED',
          actor: 'SCORE_WORKER',
          details: {
            titleFit: scoreBreakdown.titleFit,
            skillsFit: scoreBreakdown.skillsFit,
            seniorityFit: scoreBreakdown.seniorityFit,
            aiRelevance: scoreBreakdown.aiRelevance,
            backendRelevance: scoreBreakdown.backendRelevance,
            locationFit: scoreBreakdown.locationFit,
            sponsorshipRisk: scoreBreakdown.sponsorshipRisk,
            overallScore: scoreBreakdown.overallScore,
            sponsorshipLevel: sponsorshipRisk,
          },
        },
      });

      console.log(`[SCORE] Completed scoring for ${jobId}:`, {
        overallScore: scoreBreakdown.overallScore,
        sponsorshipRisk,
      });

      return {
        success: true,
        jobId,
        overallScore: scoreBreakdown.overallScore,
        sponsorshipRisk,
      };
    } catch (error) {
      console.error('[SCORE] Worker error:', error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
  },
);

// Event handlers
worker.on('completed', (job) => {
  console.log(`[SCORE] Job completed: ${job.id}`);
});

worker.on('failed', (job, error) => {
  console.error(`[SCORE] Job failed: ${job?.id}`, error);
});

worker.on('error', (error) => {
  console.error('[SCORE] Worker error:', error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[SCORE] Shutting down worker...');
  await worker.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
});

export default worker;
