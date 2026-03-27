/**
 * Generate review packet endpoint
 * POST /api/jobs/[id]/packet - Generate review packet
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActiveCandidateProfile } from '@/lib/candidate-profile';
import prisma from '@/lib/db';
import { serializeJob } from '@/lib/job-contract';
import {
  buildDeterministicPacket,
  normalizePacketPayload,
  type PacketPayload,
  type PacketJobInput,
} from '@/lib/review-packet';
import { analyzeSponsorshipSignals, ScoringProfile } from '@/lib/scoring';
import { ClaudeProvider } from '@/providers/claude';

async function generateClaudePacket(job: {
  title: string;
  companyName: string;
  sourceUrl: string;
  content: { rawText: string } | null;
  score: {
    roleFamily?: string | null;
    priorityScore?: number | null;
    positionabilityScore?: number | null;
    titleFit: number;
    skillsFit: number;
    seniorityFit: number;
    aiRelevance: number;
    backendRelevance: number;
    locationFit: number;
    sponsorshipRisk: number;
    overallScore: number;
    rationale: string;
    matchedSkills: string[];
    missingSkills: string[];
    matchedCoreSkills?: string[];
    missingCoreSkills?: string[];
    missingSecondarySkills?: string[];
    keywordGaps: string[];
    strategicRationale?: string | null;
    positionabilityNote?: string | null;
    risks?: string[];
  } | null;
}, candidateProfile: ScoringProfile) {
  const sponsorshipAnalysis = analyzeSponsorshipSignals(
    job.content?.rawText || '',
    candidateProfile,
  );
  const scoreText = `
Title Fit: ${job.score?.titleFit ?? 0}/100
Core Skill Fit: ${job.score?.skillsFit ?? 0}/100
Seniority Fit: ${job.score?.seniorityFit ?? 0}/100
Strategic Alignment: ${job.score?.aiRelevance ?? 0}/100
Growth Potential: ${job.score?.backendRelevance ?? 0}/100
Location Fit: ${job.score?.locationFit ?? 0}/100
Sponsorship Risk: ${job.score?.sponsorshipRisk ?? 0}/100
Fit Score: ${job.score?.overallScore ?? 0}/100
Priority Score: ${job.score?.priorityScore ?? 0}/100
Positionability: ${job.score?.positionabilityScore ?? 0}/100
Role Family: ${job.score?.roleFamily || ''}

Matched Core Skills: ${(job.score?.matchedCoreSkills || job.score?.matchedSkills || []).join(', ')}
Missing Core Skills: ${(job.score?.missingCoreSkills || []).join(', ')}
Missing Secondary Skills: ${(job.score?.missingSecondarySkills || []).join(', ')}
Incidental Gaps: ${(job.score?.keywordGaps || []).join(', ')}
Risks: ${(job.score?.risks || []).join(', ')}
Rationale: ${job.score?.strategicRationale || job.score?.rationale || ''}
Positionability Note: ${job.score?.positionabilityNote || ''}
Detected Sponsorship Restrictions: ${(sponsorshipAnalysis.negativeSignals || []).join(', ')}
  `;

  const prompt = `
You are helping a job candidate prepare for an application to this position:

**Job Title**: ${job.title}
**Company**: ${job.companyName}
**URL**: ${job.sourceUrl}

**Job Description**:
${job.content?.rawText || ''}

**Candidate Profile**:
- Target Titles: ${candidateProfile.targetTitles.join(', ')}
- Core Skills: ${candidateProfile.coreSkills.join(', ')}
- Preferred Skills: ${candidateProfile.preferredSkills.join(', ')}
- Years of Experience: ${candidateProfile.experienceYears}
- Seniority Level: ${candidateProfile.seniorityLevel}
- Work Authorization: ${candidateProfile.workAuth}

**Job Fit Score**:
${scoreText}

Important instruction:
- If the JD says employer sponsorship is not available, treat that as a risk for this candidate profile.
- Do not describe "no sponsorship" wording as favorable.
- Surface sponsorship constraints in both "risks" and "sponsorNotes".

Please provide valid JSON only with:
{
  "resumeEmphasis": ["skill1", "skill2"],
  "summaryRewrite": "short summary",
  "bulletsToHighlight": ["bullet 1", "bullet 2"],
  "outreachDraft": "short outreach draft",
  "interviewPrepBullets": ["prep point 1", "prep point 2"],
  "risks": ["risk 1", "risk 2"],
  "whyApply": "why this role matches",
  "sponsorNotes": "work authorization notes"
}
  `;

  const claude = new ClaudeProvider();
  const response = await claude.chat([{ role: 'user', content: prompt }]);
  const jsonMatch = response.content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  return normalizePacketPayload(
    JSON.parse(jsonMatch[0]) as Partial<PacketPayload>,
    candidateProfile.workAuth,
  );
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: {
        content: true,
        score: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (!job.content || !job.content.rawText) {
      return NextResponse.json({ error: 'Job content not found' }, { status: 400 });
    }

    if (!job.score) {
      return NextResponse.json(
        { error: 'Job must be scored before generating packet' },
        { status: 400 },
      );
    }

    const candidateProfile = await getActiveCandidateProfile(prisma);
    let packetData: PacketPayload;
    let generatedBy = 'deterministic';

    try {
      packetData = await generateClaudePacket(job, candidateProfile);
      generatedBy = 'claude';
    } catch (error) {
      console.warn('[Generate Packet Fallback]', error);
      packetData = buildDeterministicPacket(job as PacketJobInput, candidateProfile);
    }

    await prisma.reviewPacket.upsert({
      where: { jobId: job.id },
      create: {
        jobId: job.id,
        resumeEmphasis: packetData.resumeEmphasis,
        summaryRewrite: packetData.summaryRewrite,
        bulletsToHighlight: packetData.bulletsToHighlight,
        outreachDraft: packetData.outreachDraft,
        interviewPrepBullets: packetData.interviewPrepBullets,
        risks: packetData.risks,
        whyApply: packetData.whyApply,
        sponsorNotes: packetData.sponsorNotes,
        generatedBy,
      },
      update: {
        resumeEmphasis: packetData.resumeEmphasis,
        summaryRewrite: packetData.summaryRewrite,
        bulletsToHighlight: packetData.bulletsToHighlight,
        outreachDraft: packetData.outreachDraft,
        interviewPrepBullets: packetData.interviewPrepBullets,
        risks: packetData.risks,
        whyApply: packetData.whyApply,
        sponsorNotes: packetData.sponsorNotes,
        generatedBy,
      },
    });

    const updatedJob = await prisma.job.update({
      where: { id: job.id },
      data: { status: 'READY' },
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

    await prisma.auditLog.create({
      data: {
        jobId: job.id,
        action: 'GENERATE_PACKET',
        actor: 'system',
        details: {
          provider: generatedBy,
        },
      },
    });

    const serializedJob = serializeJob(updatedJob);

    return NextResponse.json(
      {
        message: 'Review packet generated successfully',
        generatedBy,
        job: serializedJob,
        packet: serializedJob.reviewPacket,
        data: {
          job: serializedJob,
          packet: serializedJob.reviewPacket,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[Generate Packet Error]', error);
    return NextResponse.json(
      { error: 'Failed to generate packet', details: String(error) },
      { status: 500 },
    );
  }
}
