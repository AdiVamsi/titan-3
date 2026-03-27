/**
 * Ingest jobs endpoint
 * POST /api/jobs/ingest - Ingest jobs from source or manual entry
 */

import { SourceType, WorkplaceType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdapterById } from '@/adapters/registry';
import prisma from '@/lib/db';
import { serializeJob } from '@/lib/job-contract';
import { normalizeAndScoreJob, WORKFLOW_JOB_INCLUDE } from '@/lib/job-workflow';

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

function buildSummaryMessage(ingested: number, duplicates: number, errors: string[]) {
  if (ingested > 0) {
    return `Ingested ${ingested} job${ingested === 1 ? '' : 's'}.`;
  }

  if (duplicates > 0 && errors.length === 0) {
    return 'No new jobs were added because they already exist.';
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

    let ingestedCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];
    const processedJobs: Array<ReturnType<typeof serializeJob>> = [];

    if (ingestRequest.mode === 'manual') {
      try {
        const existingJob = await prisma.job.findFirst({
          where: {
            OR: [
              { sourceUrl: ingestRequest.url },
              { canonicalUrl: ingestRequest.url },
            ],
          },
        });

        if (existingJob) {
          duplicateCount = 1;
        } else {
          const createdJob = await prisma.job.create({
            data: {
              title: ingestRequest.title,
              companyName: ingestRequest.companyName,
              sourceUrl: ingestRequest.url,
              sourceType: ingestRequest.sourceType || SourceType.MANUAL,
              canonicalUrl: ingestRequest.url,
              status: 'INGESTED',
              workplaceType: WorkplaceType.UNKNOWN,
              content: {
                create: {
                  rawText: ingestRequest.rawText,
                  requirements: [],
                  niceToHaves: [],
                  responsibilities: [],
                },
              },
            },
          });

          if (createdJob) {
            ingestedCount = 1;

            try {
              const result = await normalizeAndScoreJob(prisma, createdJob.id);
              processedJobs.push(serializeJob(result.job));
            } catch (workflowError) {
              errors.push(
                `Job created but scoring failed: ${workflowError instanceof Error ? workflowError.message : String(workflowError)}`,
              );

              const fallbackJob = await prisma.job.findUnique({
                where: { id: createdJob.id },
                include: WORKFLOW_JOB_INCLUDE,
              });

              if (fallbackJob) {
                processedJobs.push(serializeJob(fallbackJob));
              }
            }
          }
        }
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
            const canonicalUrl = normalizedJob.applyUrl || normalizedJob.sourceUrl || normalizedJob.id;
            const existingJob = await prisma.job.findUnique({
              where: { canonicalUrl },
            });

            if (existingJob) {
              duplicateCount++;
              continue;
            }

            const createdJob = await prisma.job.create({
              data: {
                title: normalizedJob.title,
                companyName: normalizedJob.company,
                sourceUrl: normalizedJob.sourceUrl,
                sourceType: normalizedJob.sourceType as any,
                canonicalUrl,
                location: normalizedJob.location || null,
                workplaceType: (normalizedJob.workplaceType as any) || WorkplaceType.UNKNOWN,
                salaryText: normalizedJob.salary
                  ? JSON.stringify(normalizedJob.salary)
                  : null,
                status: 'INGESTED',
                adapterId: ingestRequest.adapterId,
                content: {
                  create: {
                    rawText: normalizedJob.rawContent,
                    requirements: normalizedJob.requiredSkills || [],
                    niceToHaves: normalizedJob.preferredSkills || [],
                    responsibilities: [],
                  },
                },
              },
            });

            ingestedCount++;

            try {
              const result = await normalizeAndScoreJob(prisma, createdJob.id);
              processedJobs.push(serializeJob(result.job));
            } catch (workflowError) {
              errors.push(
                `Job '${normalizedJob.title}' was ingested but scoring failed: ${workflowError instanceof Error ? workflowError.message : String(workflowError)}`,
              );

              const fallbackJob = await prisma.job.findUnique({
                where: { id: createdJob.id },
                include: WORKFLOW_JOB_INCLUDE,
              });

              if (fallbackJob) {
                processedJobs.push(serializeJob(fallbackJob));
              }
            }
          } catch (jobErr) {
            errors.push(
              `Failed to create job '${normalizedJob.title}': ${jobErr instanceof Error ? jobErr.message : String(jobErr)}`,
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

    const message = buildSummaryMessage(ingestedCount, duplicateCount, errors);

    return NextResponse.json(
      {
        ingested: ingestedCount,
        duplicates: duplicateCount,
        errors,
        count: ingestedCount,
        message,
        job: processedJobs[0] || null,
        items: processedJobs,
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
        ingested: 0,
        duplicates: 0,
        errors: ['Failed to ingest jobs'],
      },
      { status: 500 },
    );
  }
}
