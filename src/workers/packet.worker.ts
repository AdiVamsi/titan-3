/**
 * BullMQ Worker for Review Packet Generation
 * Fetches job, content, and score from database
 * Calls AI provider to generate review packet
 * Updates ReviewPacket and job status
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { getProvider } from '../providers/index';

const prisma = new PrismaClient();

// Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
});

interface PacketJobData {
  jobId: string;
}

/**
 * Process packet generation jobs
 */
const worker = new Worker<PacketJobData>(
  'packet-queue',
  async (job: Job<PacketJobData>) => {
    console.log(`[PACKET] Processing job ${job.id}`, job.data);

    try {
      const { jobId } = job.data;

      // Fetch job, content, and score
      const jobRecord = await prisma.job.findUnique({
        where: { id: jobId },
        include: { content: true, score: true },
      });

      if (!jobRecord) {
        throw new Error(`Job not found: ${jobId}`);
      }

      if (!jobRecord.content || !jobRecord.score) {
        throw new Error(`Job content or score not found for job: ${jobId}`);
      }

      console.log(`[PACKET] Generating packet for: ${jobRecord.title} at ${jobRecord.companyName}`);

      // Select AI provider
      const provider = getProvider();
      if (!provider.isAvailable()) {
        throw new Error('No AI provider available');
      }

      // Prepare prompt for AI
      const prompt = `
You are a job application expert. Analyze the following job posting and candidate profile to generate a comprehensive review packet.

Job Title: ${jobRecord.title}
Company: ${jobRecord.companyName}
Location: ${jobRecord.location || 'Not specified'}

Job Description:
${jobRecord.content.rawText}

Candidate Fit Score: ${jobRecord.score.overallScore}%
- Title Fit: ${jobRecord.score.titleFit}%
- Skills Fit: ${jobRecord.score.skillsFit}%
- Seniority Fit: ${jobRecord.score.seniorityFit}%
- AI Relevance: ${jobRecord.score.aiRelevance}%
- Backend Relevance: ${jobRecord.score.backendRelevance}%
- Sponsorship Risk: ${jobRecord.score.sponsorshipRisk}%

Matched Skills: ${jobRecord.score.matchedSkills.join(', ')}
Missing Skills: ${jobRecord.score.missingSkills.join(', ')}
Keyword Gaps: ${jobRecord.score.keywordGaps.join(', ')}

Please generate a review packet in JSON format with the following structure:
{
  "resumeEmphasis": ["point1", "point2", "point3"],
  "summaryRewrite": "A 2-3 sentence tailored summary for this specific role",
  "bulletsToHighlight": ["bullet1", "bullet2", "bullet3"],
  "outreachDraft": "Draft outreach message if applying directly",
  "interviewPrepBullets": ["prep1", "prep2", "prep3"],
  "risks": ["risk1", "risk2"],
  "whyApply": "Why this role is a good fit",
  "sponsorNotes": "Notes about sponsorship considerations if relevant"
}

Return only valid JSON.
`;

      // Generate with AI
      const aiResponse = await provider.chat([
        {
          role: 'user',
          content: prompt,
        },
      ]);

      // Parse AI response
      let packetData;
      try {
        // Extract JSON from response
        const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in AI response');
        }
        packetData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.warn('[PACKET] Failed to parse AI response, using defaults:', parseError);
        packetData = {
          resumeEmphasis: ['Position aligns with career growth', 'Tech stack matches expertise'],
          summaryRewrite: `Experienced engineer with strong background in the required technologies, seeking to grow with ${jobRecord.companyName}.`,
          bulletsToHighlight: ['Led relevant projects', 'Demonstrated key technical skills'],
          outreachDraft: `Interested in the ${jobRecord.title} opportunity at ${jobRecord.companyName}.`,
          interviewPrepBullets: ['Prepare examples of relevant experience', 'Research company technology'],
          risks: jobRecord.score.missingSkills.length > 0 ? [`Missing some skills: ${jobRecord.score.missingSkills.slice(0, 2).join(', ')}`] : [],
          whyApply: 'Role matches career goals and uses key technical skills',
          sponsorNotes: jobRecord.score.sponsorshipRisk > 60 ? 'Verify sponsorship availability' : null,
        };
      }

      // Upsert review packet
      const reviewPacket = await prisma.reviewPacket.upsert({
        where: { jobId },
        create: {
          jobId,
          resumeEmphasis: packetData.resumeEmphasis || [],
          summaryRewrite: packetData.summaryRewrite || null,
          bulletsToHighlight: packetData.bulletsToHighlight || [],
          outreachDraft: packetData.outreachDraft || null,
          interviewPrepBullets: packetData.interviewPrepBullets || [],
          risks: packetData.risks || [],
          whyApply: packetData.whyApply || null,
          sponsorNotes: packetData.sponsorNotes || null,
          generatedBy: provider.name,
        },
        update: {
          resumeEmphasis: packetData.resumeEmphasis || [],
          summaryRewrite: packetData.summaryRewrite || null,
          bulletsToHighlight: packetData.bulletsToHighlight || [],
          outreachDraft: packetData.outreachDraft || null,
          interviewPrepBullets: packetData.interviewPrepBullets || [],
          risks: packetData.risks || [],
          whyApply: packetData.whyApply || null,
          sponsorNotes: packetData.sponsorNotes || null,
          generatedBy: provider.name,
        },
      });

      // Update job status to READY
      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'READY',
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          jobId,
          action: 'PACKET_GENERATED',
          actor: 'PACKET_WORKER',
          details: {
            provider: provider.name,
            hasOutreach: !!packetData.outreachDraft,
            risks: packetData.risks || [],
          },
        },
      });

      console.log(`[PACKET] Successfully generated packet for ${jobId}`);

      return {
        success: true,
        jobId,
        packetId: reviewPacket.id,
        provider: provider.name,
      };
    } catch (error) {
      console.error('[PACKET] Worker error:', error);
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
  console.log(`[PACKET] Job completed: ${job.id}`);
});

worker.on('failed', (job, error) => {
  console.error(`[PACKET] Job failed: ${job?.id}`, error);
});

worker.on('error', (error) => {
  console.error('[PACKET] Worker error:', error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[PACKET] Shutting down worker...');
  await worker.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
});

export default worker;
