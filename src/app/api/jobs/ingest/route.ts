/**
 * Ingest jobs endpoint
 * POST /api/jobs/ingest - Ingest jobs from source or manual entry
 */

import { SourceType, StagedJobDecision } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdapterById } from '@/adapters/registry';
import prisma from '@/lib/db';
import {
  buildStagedJobInputFromNormalizedJob,
  stageAndProcessIncomingJob,
} from '@/lib/job-intake';
import { serializeJob } from '@/lib/job-contract';

const IngestConfigSchema = z
  .object({
    query: z.string().optional(),
    location: z.string().optional(),
    maxResults: z.number().optional(),
    boardUrl: z.string().optional(),
  })
  .default({});

const IngestAdapterSchema = z.object({
  manual: z.literal(false),
  adapter: z.string().min(1),
  queryOrUrl: z.string().min(1),
  config: IngestConfigSchema.optional().default({}),
});

const IngestLegacyAdapterSchema = z.object({
  adapterId: z.string().min(1),
  config: IngestConfigSchema,
});

const IngestSourceCompatibilitySchema = z.object({
  method: z.literal('source'),
  adapterId: z.string().min(1),
  sourceUrl: z.string().min(1),
  location: z.string().optional(),
  maxResults: z.number().optional(),
});

const IngestManualSchema = z.object({
  manual: z.literal(true),
  url: z.string().url(),
  rawText: z.string().min(1),
  title: z.string().min(1),
  companyName: z.string().min(1),
  sourceType: z.nativeEnum(SourceType).optional(),
});

const IngestManualCompatibilitySchema = z.object({
  method: z.literal('manual'),
  sourceUrl: z.string().url(),
  title: z.string().min(1),
  company: z.string().min(1),
  jdText: z.string().min(1),
});

const IngestSchema = z.union([
  IngestAdapterSchema,
  IngestLegacyAdapterSchema,
  IngestSourceCompatibilitySchema,
  IngestManualSchema,
  IngestManualCompatibilitySchema,
]);

type ManualIngestRequest = {
  mode: 'manual';
  url: string;
  rawText: string;
  title: string;
  companyName: string;
  sourceType?: SourceType;
};

type AdapterIngestRequest = {
  mode: 'adapter';
  adapterId: string;
  config: {
    query?: string;
    location?: string;
    maxResults?: number;
    boardUrl?: string;
  };
};

type NormalizedIngestRequest = ManualIngestRequest | AdapterIngestRequest;

function normalizeIngestRequest(input: z.infer<typeof IngestSchema>): NormalizedIngestRequest {
  if ('manual' in input && input.manual === false) {
    const looksLikeUrl = /^https?:\/\//i.test(input.queryOrUrl);

    return {
      mode: 'adapter',
      adapterId: input.adapter,
      config: {
        ...input.config,
        boardUrl: input.config.boardUrl || (looksLikeUrl ? input.queryOrUrl : undefined),
        query: input.config.query || (!looksLikeUrl ? input.queryOrUrl : undefined),
      },
    };
  }

  if ('manual' in input && input.manual) {
    return {
      mode: 'manual',
      url: input.url,
      rawText: input.rawText,
      title: input.title,
      companyName: input.companyName,
      sourceType: input.sourceType,
    };
  }

  if ('method' in input && input.method === 'manual') {
    return {
      mode: 'manual',
      url: input.sourceUrl,
      rawText: input.jdText,
      title: input.title,
      companyName: input.company,
      sourceType: SourceType.MANUAL,
    };
  }

  if ('method' in input && input.method === 'source') {
    const looksLikeUrl = /^https?:\/\//i.test(input.sourceUrl);

    return {
      mode: 'adapter',
      adapterId: input.adapterId,
      config: {
        boardUrl: input.sourceUrl,
        query: looksLikeUrl ? undefined : input.sourceUrl,
        location: input.location,
        maxResults: input.maxResults,
      },
    };
  }

  if ('adapterId' in input && 'config' in input) {
    return {
      mode: 'adapter',
      adapterId: input.adapterId,
      config: input.config,
    };
  }

  throw new Error('Unsupported ingest request shape');
}

function buildSummaryMessage(
  accepted: number,
  review: number,
  rejected: number,
  duplicates: number,
  errors: string[],
) {
  if (accepted > 0) {
    return `Accepted ${accepted} job${accepted === 1 ? '' : 's'} into Titan-3, kept ${review} in review, and rejected ${rejected}.`;
  }

  if (review > 0) {
    return `No jobs were auto-accepted. ${review} job${review === 1 ? '' : 's'} moved to review and ${rejected} were rejected.`;
  }

  if (duplicates > 0 && errors.length === 0) {
    return 'No jobs were accepted because they were duplicates or already staged.';
  }

  if (errors.length > 0) {
    return errors[0];
  }

  return 'No jobs were ingested.';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ingestRequest = normalizeIngestRequest(IngestSchema.parse(body));

    let stagedCount = 0;
    let acceptedCount = 0;
    let reviewCount = 0;
    let rejectedCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];
    const processedJobs: Array<ReturnType<typeof serializeJob>> = [];
    const stagedItems: Array<{
      id: string;
      pipelineState: string;
      filterDecision: string | null;
      filterReasons: string[];
      dedupeReason: string | null;
      normalizedRoleFamily: string | null;
      freshnessBucket: string;
      openStatus: string;
      acceptedJobId: string | null;
    }> = [];

    const recordStageResult = (
      result: Awaited<ReturnType<typeof stageAndProcessIncomingJob>>,
    ) => {
      stagedCount++;
      stagedItems.push({
        id: result.stagedJob.id,
        pipelineState: result.stagedJob.pipelineState,
        filterDecision: result.stagedJob.filterDecision,
        filterReasons: result.stagedJob.filterReasons,
        dedupeReason: result.stagedJob.dedupeReason,
        normalizedRoleFamily: result.stagedJob.normalizedRoleFamily,
        freshnessBucket: result.stagedJob.freshnessBucket,
        openStatus: result.stagedJob.openStatus,
        acceptedJobId: result.stagedJob.acceptedJobId,
      });

      if (result.stagedJob.dedupeReason) {
        duplicateCount++;
      }

      switch (result.stagedJob.filterDecision) {
        case StagedJobDecision.ACCEPT:
          if (result.acceptedJob) {
            acceptedCount++;
            processedJobs.push(serializeJob(result.acceptedJob));
          } else {
            rejectedCount++;
          }
          break;
        case StagedJobDecision.REVIEW:
          reviewCount++;
          break;
        case StagedJobDecision.REJECT:
        default:
          rejectedCount++;
          break;
      }
    };

    if (ingestRequest.mode === 'manual') {
      try {
        const result = await stageAndProcessIncomingJob(prisma, {
          sourceName: 'manual',
          sourceType: ingestRequest.sourceType || SourceType.MANUAL,
          sourceUrl: ingestRequest.url,
          canonicalUrl: ingestRequest.url,
          rawTitle: ingestRequest.title,
          rawCompany: ingestRequest.companyName,
          rawDescription: ingestRequest.rawText,
          metadata: {
            seenInLiveSource: false,
            submittedFrom: 'manual-ingest',
          },
        });

        recordStageResult(result);
      } catch (err) {
        errors.push(
          `Failed to ingest manual job: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      const adapter = getAdapterById(ingestRequest.adapterId);

      if (!adapter) {
        const message = `Adapter '${ingestRequest.adapterId}' not found`;
        return NextResponse.json(
          { error: message, message, ingested: 0, duplicates: 0, errors: [message] },
          { status: 404 },
        );
      }

      if (!adapter.capabilities.canIngest) {
        const message = `Adapter '${ingestRequest.adapterId}' does not support ingestion`;
        return NextResponse.json(
          { error: message, message, ingested: 0, duplicates: 0, errors: [message] },
          { status: 400 },
        );
      }

      try {
        const result = await adapter.ingest(ingestRequest.config);

        for (const normalizedJob of result.jobs) {
          try {
            const stageResult = await stageAndProcessIncomingJob(
              prisma,
              buildStagedJobInputFromNormalizedJob(normalizedJob, ingestRequest.adapterId),
            );

            recordStageResult(stageResult);
          } catch (jobErr) {
            errors.push(
              `Failed to stage job '${normalizedJob.title}': ${jobErr instanceof Error ? jobErr.message : String(jobErr)}`,
            );
          }
        }

        if (result.errors.length > 0) {
          errors.push(...result.errors);
        }
      } catch (err) {
        errors.push(
          `Adapter ingestion failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const message = buildSummaryMessage(
      acceptedCount,
      reviewCount,
      rejectedCount,
      duplicateCount,
      errors,
    );

    return NextResponse.json(
      {
        staged: stagedCount,
        accepted: acceptedCount,
        review: reviewCount,
        rejected: rejectedCount,
        ingested: acceptedCount,
        duplicates: duplicateCount,
        errors,
        count: acceptedCount,
        message,
        job: processedJobs[0] || null,
        items: processedJobs,
        stagedItems,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[Ingest Error]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          message: 'Invalid request body',
          details: error.errors,
          staged: 0,
          accepted: 0,
          review: 0,
          rejected: 0,
          ingested: 0,
          duplicates: 0,
          errors: ['Invalid request body'],
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to ingest jobs',
        message: 'Failed to ingest jobs',
        staged: 0,
        accepted: 0,
        review: 0,
        rejected: 0,
        ingested: 0,
        duplicates: 0,
        errors: ['Failed to ingest jobs'],
      },
      { status: 500 },
    );
  }
}
