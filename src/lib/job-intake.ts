import { createHash } from 'crypto';

import {
  FreshnessBucket,
  OpenStatus,
  Prisma,
  PrismaClient,
  SourceType,
  StagedJobDecision,
  StagedJobStatus,
  WorkplaceType,
} from '@prisma/client';

import { JOB_INTAKE_CONFIG } from '@/lib/job-intake-config';
import { WORKFLOW_JOB_INCLUDE, normalizeAndScoreJob } from '@/lib/job-workflow';
import { NormalizedJob } from '@/lib/types';

type IntakeDbClient = PrismaClient | Prisma.TransactionClient;

type AcceptedJob = Prisma.JobGetPayload<{
  include: typeof WORKFLOW_JOB_INCLUDE;
}>;

type StoredStagedJob = Prisma.StagedJobGetPayload<{}>;

export type StageIncomingJobInput = {
  sourceName: string;
  sourceType?: SourceType;
  sourceUrl: string;
  canonicalUrl?: string | null;
  externalId?: string | null;
  rawTitle: string;
  rawCompany: string;
  rawLocation?: string | null;
  rawDescription: string;
  postedAtRaw?: string | null;
  postedAtNormalized?: Date | string | null;
  workplaceTypeRaw?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export type StageAndProcessResult = {
  stagedJob: StoredStagedJob;
  acceptedJob: AcceptedJob | null;
};

type NormalizedStageResult = {
  normalizedTitle: string;
  normalizedCompany: string;
  normalizedLocation: string | null;
  workplaceType: WorkplaceType;
  cleanedText: string;
  yearsExperienceRequired: number | null;
  yearsExperienceRaw: string | null;
  seniorityBucket: string | null;
  senioritySignals: string[];
  skillKeywords: string[];
  sponsorshipSignals: string[];
  normalizedRoleFamily: string | null;
  descriptionHash: string;
  postedAtNormalized: Date | null;
  freshnessBucket: FreshnessBucket;
  freshnessDecisionReason: string;
  openStatus: OpenStatus;
  openStatusReason: string;
};

type DedupeResult = {
  isDuplicate: boolean;
  reason: string | null;
  duplicateOfJobId: string | null;
  duplicateOfStagedJobId: string | null;
};

type ClassificationResult = {
  filterDecision: StagedJobDecision;
  filterReasons: string[];
};

function normalizeScalar(value?: string | null) {
  return value?.replace(/\s+/g, ' ').trim() || '';
}

function cleanText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeLocation(value?: string | null) {
  const normalized = normalizeScalar(value);
  return normalized || null;
}

function canonicalizeUrl(value?: string | null) {
  const normalized = normalizeScalar(value);

  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return normalized;
  }
}

function mapSourceType(value?: string | null) {
  if (!value) {
    return SourceType.OTHER;
  }

  const normalized = value.trim().toUpperCase();

  if (Object.values(SourceType).includes(normalized as SourceType)) {
    return normalized as SourceType;
  }

  return SourceType.OTHER;
}

function parsePostedAt(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function matchesAnyPattern(value: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function findFirstKeyword(value: string, keywords: readonly string[]) {
  return keywords.find((keyword) => value.includes(keyword.toLowerCase())) || null;
}

function extractYearsExperienceSignal(value: string) {
  const matches: Array<{ years: number; raw: string }> = [];
  const patterns = [
    /(?:minimum of |at least |minimum )?(\d{1,2})\s*(?:\+|plus)?\s*(?:-|to)?\s*(\d{1,2})?\s+years?[^.\n]{0,40}experience/gi,
    /(\d{1,2})\+\s+years?[^.\n]{0,40}experience/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(value)) !== null) {
      const first = Number(match[1] || 0);
      const second = Number(match[2] || 0);
      matches.push({
        years: Math.max(first, second),
        raw: normalizeScalar(match[0]),
      });
    }
  }

  if (matches.length === 0) {
    return {
      yearsExperienceRequired: null,
      yearsExperienceRaw: null,
    };
  }

  const best = matches.sort((left, right) => right.years - left.years)[0];

  return {
    yearsExperienceRequired: best.years,
    yearsExperienceRaw: best.raw,
  };
}

function deriveSeniority(title: string, cleanedText: string) {
  const normalizedTitle = title.toLowerCase();
  const normalizedText = `${normalizedTitle}\n${cleanedText.toLowerCase()}`;
  const signals: string[] = [];

  if (matchesAnyPattern(normalizedTitle, JOB_INTAKE_CONFIG.earlyCareerPatterns)) {
    signals.push('early-career title marker');
  }

  if (matchesAnyPattern(normalizedTitle, JOB_INTAKE_CONFIG.excludedTitlePatterns)) {
    signals.push('excluded senior title marker');
  } else if (matchesAnyPattern(normalizedText, JOB_INTAKE_CONFIG.seniorPatterns)) {
    signals.push('senior title or scope marker');
  }

  if (signals.includes('excluded senior title marker')) {
    return {
      seniorityBucket: 'LEADERSHIP',
      senioritySignals: signals,
    };
  }

  if (signals.includes('early-career title marker')) {
    return {
      seniorityBucket: 'EARLY_CAREER',
      senioritySignals: signals,
    };
  }

  if (signals.includes('senior title or scope marker')) {
    return {
      seniorityBucket: 'SENIOR',
      senioritySignals: signals,
    };
  }

  return {
    seniorityBucket: 'MID',
    senioritySignals: signals,
  };
}

function deriveSkillKeywords(value: string) {
  const normalized = value.toLowerCase();

  return JOB_INTAKE_CONFIG.preferredKeywords.filter((keyword) =>
    normalized.includes(keyword.toLowerCase()),
  );
}

function deriveSponsorshipSignals(value: string, metadata: unknown) {
  const normalizedText = `${value}\n${serializeMetadata(metadata)}`.toLowerCase();
  const signals = [
    'visa sponsorship',
    'sponsorship',
    'work authorization',
    'h1b',
    'stem opt',
  ];

  return signals.filter((signal) => normalizedText.includes(signal));
}

function deriveRoleFamily(title: string, cleanedText: string, skillKeywords: string[]) {
  const normalizedTitle = title.toLowerCase();
  const combined = `${normalizedTitle}\n${cleanedText.toLowerCase()}`;

  if (
    matchesAnyPattern(normalizedTitle, JOB_INTAKE_CONFIG.roleFamilies.AI_GENAI) ||
    ['ai', 'applied ai', 'genai', 'llm', 'machine learning', 'rag', 'vector'].some((keyword) =>
      skillKeywords.includes(keyword),
    )
  ) {
    return 'AI_GENAI';
  }

  if (
    matchesAnyPattern(normalizedTitle, JOB_INTAKE_CONFIG.roleFamilies.BACKEND_PLATFORM) ||
    ['backend', 'platform', 'python', 'api'].some((keyword) =>
      skillKeywords.includes(keyword),
    )
  ) {
    return 'BACKEND_PLATFORM';
  }

  if (
    matchesAnyPattern(normalizedTitle, JOB_INTAKE_CONFIG.roleFamilies.SOFTWARE_GENERALIST) ||
    combined.includes('software engineer')
  ) {
    return 'SOFTWARE_GENERALIST';
  }

  return null;
}

function deriveWorkplaceType(
  workplaceTypeRaw: string | null | undefined,
  rawLocation: string | null | undefined,
  cleanedText: string,
) {
  const combined = `${normalizeScalar(workplaceTypeRaw)} ${normalizeScalar(rawLocation)} ${cleanedText}`
    .toLowerCase();

  if (combined.includes('hybrid')) {
    return WorkplaceType.HYBRID;
  }

  if (
    combined.includes('remote') ||
    combined.includes('work from home') ||
    combined.includes('anywhere in')
  ) {
    return WorkplaceType.REMOTE;
  }

  if (
    combined.includes('onsite') ||
    combined.includes('on-site') ||
    combined.includes('in office') ||
    combined.includes('office-based')
  ) {
    return WorkplaceType.ONSITE;
  }

  return WorkplaceType.UNKNOWN;
}

function buildFreshness(postedAt: Date | null) {
  if (!postedAt) {
    return {
      freshnessBucket: FreshnessBucket.UNKNOWN,
      freshnessDecisionReason: 'Posting date is unknown.',
    };
  }

  const ageMs = Date.now() - postedAt.getTime();
  const ageDays = Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));

  if (ageDays <= 1) {
    return {
      freshnessBucket: FreshnessBucket.LAST_24_HOURS,
      freshnessDecisionReason: 'Posting is within the last 24 hours.',
    };
  }

  if (ageDays <= 3) {
    return {
      freshnessBucket: FreshnessBucket.LAST_3_DAYS,
      freshnessDecisionReason: `Posting is ${ageDays} day(s) old.`,
    };
  }

  if (ageDays <= JOB_INTAKE_CONFIG.freshness.maxAcceptAgeDays) {
    return {
      freshnessBucket: FreshnessBucket.LAST_7_DAYS,
      freshnessDecisionReason: `Posting is ${ageDays} day(s) old and still within the accept window.`,
    };
  }

  if (ageDays <= JOB_INTAKE_CONFIG.freshness.maxReviewAgeDays) {
    return {
      freshnessBucket: FreshnessBucket.LAST_14_DAYS,
      freshnessDecisionReason: `Posting is ${ageDays} day(s) old and belongs in review, not auto-accept.`,
    };
  }

  if (ageDays <= JOB_INTAKE_CONFIG.freshness.staleAgeDays) {
    return {
      freshnessBucket: FreshnessBucket.LAST_30_DAYS,
      freshnessDecisionReason: `Posting is ${ageDays} day(s) old and trending stale.`,
    };
  }

  return {
    freshnessBucket: FreshnessBucket.STALE,
    freshnessDecisionReason: `Posting is ${ageDays} day(s) old and stale by policy.`,
  };
}

function metadataFlag(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return false;
  }

  return (metadata as Record<string, unknown>)[key] === true;
}

function serializeMetadata(metadata: unknown) {
  if (!metadata) {
    return '';
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return '';
  }
}

function deriveOpenStatus(cleanedText: string, metadata: unknown) {
  const combined = `${cleanedText}\n${serializeMetadata(metadata)}`.toLowerCase();

  if (JOB_INTAKE_CONFIG.openStatus.closedPhrases.some((phrase) => combined.includes(phrase))) {
    return {
      openStatus: OpenStatus.CLOSED,
      openStatusReason: 'Posting contains a closed or expired signal.',
    };
  }

  if (metadataFlag(metadata, 'seenInLiveSource')) {
    return {
      openStatus: OpenStatus.OPEN,
      openStatusReason: 'Job was collected from a live source listing.',
    };
  }

  if (JOB_INTAKE_CONFIG.openStatus.openPhrases.some((phrase) => combined.includes(phrase))) {
    return {
      openStatus: OpenStatus.OPEN,
      openStatusReason: 'Posting text contains an open/active hiring signal.',
    };
  }

  return {
    openStatus: OpenStatus.UNKNOWN,
    openStatusReason: 'No reliable open/closed signal was found.',
  };
}

function buildTitleLocationJobWhere(
  normalizedTitle: string,
  normalizedCompany: string,
  normalizedLocation: string | null,
): Prisma.JobWhereInput {
  const where: Prisma.JobWhereInput = {
    title: { equals: normalizedTitle, mode: 'insensitive' },
    companyName: { equals: normalizedCompany, mode: 'insensitive' },
  };

  if (normalizedLocation) {
    where.location = { equals: normalizedLocation, mode: 'insensitive' };
  }

  return where;
}

function buildTitleLocationStagedWhere(
  stagedJobId: string,
  normalizedTitle: string,
  normalizedCompany: string,
  normalizedLocation: string | null,
): Prisma.StagedJobWhereInput {
  const where: Prisma.StagedJobWhereInput = {
    id: { not: stagedJobId },
    normalizedTitle: { equals: normalizedTitle, mode: 'insensitive' },
    normalizedCompany: { equals: normalizedCompany, mode: 'insensitive' },
  };

  if (normalizedLocation) {
    where.normalizedLocation = { equals: normalizedLocation, mode: 'insensitive' };
  }

  return where;
}

export function normalizeStagedJob(stagedJob: {
  rawTitle: string;
  rawCompany: string;
  rawLocation?: string | null;
  rawDescription: string;
  workplaceTypeRaw?: string | null;
  postedAtRaw?: string | null;
  postedAtNormalized?: Date | null;
  metadata?: unknown;
}) {
  const normalizedTitle = normalizeScalar(stagedJob.rawTitle);
  const normalizedCompany = normalizeScalar(stagedJob.rawCompany);
  const normalizedLocation = normalizeLocation(stagedJob.rawLocation);
  const cleanedText = cleanText(stagedJob.rawDescription || '');
  const workplaceType = deriveWorkplaceType(
    stagedJob.workplaceTypeRaw,
    stagedJob.rawLocation,
    cleanedText,
  );
  const { yearsExperienceRequired, yearsExperienceRaw } = extractYearsExperienceSignal(
    `${normalizedTitle}\n${cleanedText}`,
  );
  const { seniorityBucket, senioritySignals } = deriveSeniority(normalizedTitle, cleanedText);
  const skillKeywords = deriveSkillKeywords(`${normalizedTitle}\n${cleanedText}`);
  const sponsorshipSignals = deriveSponsorshipSignals(cleanedText, stagedJob.metadata);
  const normalizedRoleFamily = deriveRoleFamily(normalizedTitle, cleanedText, skillKeywords);
  const postedAtNormalized =
    stagedJob.postedAtNormalized || parsePostedAt(stagedJob.postedAtRaw);
  const { freshnessBucket, freshnessDecisionReason } = buildFreshness(postedAtNormalized);
  const { openStatus, openStatusReason } = deriveOpenStatus(cleanedText, stagedJob.metadata);

  return {
    normalizedTitle,
    normalizedCompany,
    normalizedLocation,
    workplaceType,
    cleanedText,
    yearsExperienceRequired,
    yearsExperienceRaw,
    seniorityBucket,
    senioritySignals,
    skillKeywords,
    sponsorshipSignals,
    normalizedRoleFamily,
    descriptionHash: hashText(cleanedText),
    postedAtNormalized,
    freshnessBucket,
    freshnessDecisionReason,
    openStatus,
    openStatusReason,
  } satisfies NormalizedStageResult;
}

export async function dedupeStagedJob(
  db: IntakeDbClient,
  stagedJobId: string,
  stagedJob: {
    sourceType: SourceType;
    sourceUrl: string;
    canonicalUrl: string | null;
    externalId: string | null;
  },
  normalized: NormalizedStageResult,
): Promise<DedupeResult> {
  if (stagedJob.canonicalUrl) {
    const existingJob = await db.job.findFirst({
      where: {
        OR: [
          { canonicalUrl: stagedJob.canonicalUrl },
          { sourceUrl: stagedJob.canonicalUrl },
        ],
      },
      select: { id: true },
    });

    if (existingJob) {
      return {
        isDuplicate: true,
        reason: 'Duplicate canonical URL matches an existing Titan-3 job.',
        duplicateOfJobId: existingJob.id,
        duplicateOfStagedJobId: null,
      };
    }

    const existingStage = await db.stagedJob.findFirst({
      where: {
        id: { not: stagedJobId },
        OR: [
          { canonicalUrl: stagedJob.canonicalUrl },
          { sourceUrl: stagedJob.canonicalUrl },
        ],
      },
      select: { id: true },
    });

    if (existingStage) {
      return {
        isDuplicate: true,
        reason: 'Duplicate canonical URL matches an existing staged job.',
        duplicateOfJobId: null,
        duplicateOfStagedJobId: existingStage.id,
      };
    }
  }

  const existingSourceUrlJob = await db.job.findFirst({
    where: { sourceUrl: stagedJob.sourceUrl },
    select: { id: true },
  });

  if (existingSourceUrlJob) {
    return {
      isDuplicate: true,
      reason: 'Duplicate source URL matches an existing Titan-3 job.',
      duplicateOfJobId: existingSourceUrlJob.id,
      duplicateOfStagedJobId: null,
    };
  }

  const existingSourceUrlStage = await db.stagedJob.findFirst({
    where: {
      id: { not: stagedJobId },
      sourceUrl: stagedJob.sourceUrl,
    },
    select: { id: true },
  });

  if (existingSourceUrlStage) {
    return {
      isDuplicate: true,
      reason: 'Duplicate source URL matches an existing staged job.',
      duplicateOfJobId: null,
      duplicateOfStagedJobId: existingSourceUrlStage.id,
    };
  }

  if (stagedJob.externalId) {
    const existingExternalIdJob = await db.job.findFirst({
      where: {
        externalId: stagedJob.externalId,
        sourceType: stagedJob.sourceType,
      },
      select: { id: true },
    });

    if (existingExternalIdJob) {
      return {
        isDuplicate: true,
        reason: 'Duplicate external ID matches an existing Titan-3 job.',
        duplicateOfJobId: existingExternalIdJob.id,
        duplicateOfStagedJobId: null,
      };
    }

    const existingExternalIdStage = await db.stagedJob.findFirst({
      where: {
        id: { not: stagedJobId },
        externalId: stagedJob.externalId,
        sourceType: stagedJob.sourceType,
      },
      select: { id: true },
    });

    if (existingExternalIdStage) {
      return {
        isDuplicate: true,
        reason: 'Duplicate external ID matches an existing staged job.',
        duplicateOfJobId: null,
        duplicateOfStagedJobId: existingExternalIdStage.id,
      };
    }
  }

  if (
    normalized.normalizedTitle &&
    normalized.normalizedCompany &&
    normalized.normalizedLocation
  ) {
    const titleLocationJob = await db.job.findFirst({
      where: buildTitleLocationJobWhere(
        normalized.normalizedTitle,
        normalized.normalizedCompany,
        normalized.normalizedLocation,
      ),
      select: { id: true },
    });

    if (titleLocationJob) {
      return {
        isDuplicate: true,
        reason: 'Duplicate company/title/location matches an existing Titan-3 job.',
        duplicateOfJobId: titleLocationJob.id,
        duplicateOfStagedJobId: null,
      };
    }

    const titleLocationStage = await db.stagedJob.findFirst({
      where: buildTitleLocationStagedWhere(
        stagedJobId,
        normalized.normalizedTitle,
        normalized.normalizedCompany,
        normalized.normalizedLocation,
      ),
      select: { id: true },
    });

    if (titleLocationStage) {
      return {
        isDuplicate: true,
        reason: 'Duplicate company/title/location matches an existing staged job.',
        duplicateOfJobId: null,
        duplicateOfStagedJobId: titleLocationStage.id,
      };
    }
  }

  const matchingHashStage = await db.stagedJob.findFirst({
    where: {
      id: { not: stagedJobId },
      descriptionHash: normalized.descriptionHash,
      normalizedCompany: { equals: normalized.normalizedCompany, mode: 'insensitive' },
    },
    select: { id: true },
  });

  if (matchingHashStage) {
    return {
      isDuplicate: true,
      reason: 'Duplicate JD hash matches an existing staged job for the same company.',
      duplicateOfJobId: null,
      duplicateOfStagedJobId: matchingHashStage.id,
    };
  }

  return {
    isDuplicate: false,
    reason: null,
    duplicateOfJobId: null,
    duplicateOfStagedJobId: null,
  };
}

export function classifyStagedJob(
  normalized: NormalizedStageResult,
  dedupe: DedupeResult,
) {
  const reasons: string[] = [];
  const normalizedTitle = normalized.normalizedTitle.toLowerCase();
  const blockedKeyword = findFirstKeyword(normalizedTitle, JOB_INTAKE_CONFIG.blockedKeywords);
  const hasReviewTitleMatch = matchesAnyPattern(
    normalizedTitle,
    JOB_INTAKE_CONFIG.reviewTitlePatterns,
  );
  const isStrongRoleFamily =
    normalized.normalizedRoleFamily === 'AI_GENAI' ||
    normalized.normalizedRoleFamily === 'BACKEND_PLATFORM';
  const isGeneralistRole = normalized.normalizedRoleFamily === 'SOFTWARE_GENERALIST';
  const hasPreferredKeywordSupport = normalized.skillKeywords.length > 0;

  if (dedupe.isDuplicate) {
    return {
      filterDecision: StagedJobDecision.REJECT,
      filterReasons: [dedupe.reason || 'Duplicate job detected.'],
    } satisfies ClassificationResult;
  }

  if (normalized.openStatus === OpenStatus.CLOSED) {
    return {
      filterDecision: StagedJobDecision.REJECT,
      filterReasons: [normalized.openStatusReason],
    } satisfies ClassificationResult;
  }

  if (matchesAnyPattern(normalizedTitle, JOB_INTAKE_CONFIG.excludedTitlePatterns)) {
    return {
      filterDecision: StagedJobDecision.REJECT,
      filterReasons: ['Title falls into an excluded senior or manager-heavy bucket.'],
    } satisfies ClassificationResult;
  }

  if (blockedKeyword) {
    return {
      filterDecision: StagedJobDecision.REJECT,
      filterReasons: [`Blocked keyword indicates an unrelated role: ${blockedKeyword}.`],
    } satisfies ClassificationResult;
  }

  if (normalized.seniorityBucket === 'LEADERSHIP') {
    return {
      filterDecision: StagedJobDecision.REJECT,
      filterReasons: ['Seniority markers indicate a leadership or too-senior role.'],
    } satisfies ClassificationResult;
  }

  if (
    normalized.yearsExperienceRequired !== null &&
    normalized.yearsExperienceRequired > JOB_INTAKE_CONFIG.experience.maxReviewYears
  ) {
    return {
      filterDecision: StagedJobDecision.REJECT,
      filterReasons: [
        `Years-of-experience signal (${normalized.yearsExperienceRequired}+) is above the review threshold.`,
      ],
    } satisfies ClassificationResult;
  }

  if (normalized.freshnessBucket === FreshnessBucket.STALE) {
    return {
      filterDecision: StagedJobDecision.REJECT,
      filterReasons: [normalized.freshnessDecisionReason],
    } satisfies ClassificationResult;
  }

  if (!isStrongRoleFamily && !isGeneralistRole && !hasReviewTitleMatch && !hasPreferredKeywordSupport) {
    return {
      filterDecision: StagedJobDecision.REJECT,
      filterReasons: ['Role does not match the target technical families or keyword set.'],
    } satisfies ClassificationResult;
  }

  if (normalized.normalizedRoleFamily) {
    reasons.push(`Role family matched ${normalized.normalizedRoleFamily}.`);
  }

  if (hasPreferredKeywordSupport) {
    reasons.push(`Matched preferred keywords: ${normalized.skillKeywords.slice(0, 5).join(', ')}.`);
  }

  if (
    normalized.yearsExperienceRequired !== null &&
    normalized.yearsExperienceRequired > JOB_INTAKE_CONFIG.experience.maxAcceptYears
  ) {
    reasons.push(
      `Years-of-experience signal (${normalized.yearsExperienceRequired}+) pushes this into review.`,
    );
  }

  if (normalized.freshnessBucket === FreshnessBucket.UNKNOWN) {
    reasons.push(normalized.freshnessDecisionReason);
    return {
      filterDecision: JOB_INTAKE_CONFIG.freshness.allowUnknownPostedAtAccept
        ? StagedJobDecision.ACCEPT
        : StagedJobDecision.REVIEW,
      filterReasons: reasons,
    } satisfies ClassificationResult;
  }

  if (normalized.freshnessBucket === FreshnessBucket.LAST_30_DAYS) {
    if (normalized.openStatus === OpenStatus.OPEN && (isStrongRoleFamily || hasPreferredKeywordSupport)) {
      reasons.push(normalized.freshnessDecisionReason);
      return {
        filterDecision: StagedJobDecision.REVIEW,
        filterReasons: reasons,
      } satisfies ClassificationResult;
    }

    return {
      filterDecision: StagedJobDecision.REJECT,
      filterReasons: [normalized.freshnessDecisionReason],
    } satisfies ClassificationResult;
  }

  if (normalized.freshnessBucket === FreshnessBucket.LAST_14_DAYS) {
    reasons.push(normalized.freshnessDecisionReason);
    return {
      filterDecision: StagedJobDecision.REVIEW,
      filterReasons: reasons,
    } satisfies ClassificationResult;
  }

  if (
    normalized.openStatus === OpenStatus.UNKNOWN &&
    !JOB_INTAKE_CONFIG.freshness.allowUnknownOpenStatusAccept
  ) {
    reasons.push(normalized.openStatusReason);
    return {
      filterDecision: StagedJobDecision.REVIEW,
      filterReasons: reasons,
    } satisfies ClassificationResult;
  }

  if (
    normalized.yearsExperienceRequired !== null &&
    normalized.yearsExperienceRequired > JOB_INTAKE_CONFIG.experience.maxAcceptYears
  ) {
    return {
      filterDecision: StagedJobDecision.REVIEW,
      filterReasons: reasons,
    } satisfies ClassificationResult;
  }

  if (isGeneralistRole && !hasPreferredKeywordSupport) {
    reasons.push('Generalist software title needs manual review because the stack signal is broad.');
    return {
      filterDecision: StagedJobDecision.REVIEW,
      filterReasons: reasons,
    } satisfies ClassificationResult;
  }

  reasons.push(normalized.freshnessDecisionReason);
  reasons.push(normalized.openStatusReason);

  return {
    filterDecision: StagedJobDecision.ACCEPT,
    filterReasons: reasons,
  } satisfies ClassificationResult;
}

export async function acceptStagedJob(
  db: IntakeDbClient,
  stagedJobId: string,
) {
  const stagedJob = await db.stagedJob.findUnique({
    where: { id: stagedJobId },
  });

  if (!stagedJob) {
    throw new Error(`Staged job not found: ${stagedJobId}`);
  }

  const canonicalUrl = canonicalizeUrl(stagedJob.canonicalUrl || stagedJob.sourceUrl);
  const existingJob = await db.job.findFirst({
    where: {
      OR: [
        canonicalUrl ? { canonicalUrl } : undefined,
        { sourceUrl: stagedJob.sourceUrl },
      ].filter(Boolean) as Prisma.JobWhereInput[],
    },
    select: { id: true },
  });

  if (existingJob) {
    await db.stagedJob.update({
      where: { id: stagedJobId },
      data: {
        pipelineState: StagedJobStatus.REJECTED,
        filterDecision: StagedJobDecision.REJECT,
        filterReasons: [
          'Duplicate was detected during acceptance.',
        ],
        dedupeReason: 'Duplicate was detected during acceptance.',
        duplicateOfJobId: existingJob.id,
      },
    });

    return null;
  }

  const createdJob = await db.job.create({
    data: {
      externalId: stagedJob.externalId || null,
      sourceType: stagedJob.sourceType,
      sourceUrl: stagedJob.sourceUrl,
      canonicalUrl,
      adapterId: stagedJob.sourceName,
      title: stagedJob.normalizedTitle || stagedJob.rawTitle,
      companyName: stagedJob.normalizedCompany || stagedJob.rawCompany,
      location: stagedJob.normalizedLocation || stagedJob.rawLocation || null,
      workplaceType: stagedJob.workplaceType,
      postedAt: stagedJob.postedAtNormalized,
      status: 'INGESTED',
      content: {
        create: {
          rawText: stagedJob.rawDescription,
          cleanedText: stagedJob.cleanedText,
          requirements: [],
          niceToHaves: [],
          responsibilities: [],
        },
      },
    },
    include: WORKFLOW_JOB_INCLUDE,
  });

  const result = await normalizeAndScoreJob(db, createdJob.id);

  await db.stagedJob.update({
    where: { id: stagedJobId },
    data: {
      pipelineState: StagedJobStatus.ACCEPTED,
      acceptedJobId: result.job.id,
      processingError: null,
    },
  });

  return result.job;
}

export async function stageIncomingJob(
  db: IntakeDbClient,
  input: StageIncomingJobInput,
) {
  return db.stagedJob.create({
    data: {
      sourceName: normalizeScalar(input.sourceName),
      sourceType: input.sourceType || SourceType.OTHER,
      sourceUrl: normalizeScalar(input.sourceUrl),
      canonicalUrl: canonicalizeUrl(input.canonicalUrl || input.sourceUrl),
      externalId: normalizeScalar(input.externalId) || null,
      rawTitle: normalizeScalar(input.rawTitle),
      rawCompany: normalizeScalar(input.rawCompany),
      rawLocation: normalizeLocation(input.rawLocation),
      rawDescription: input.rawDescription,
      workplaceTypeRaw: normalizeScalar(input.workplaceTypeRaw) || null,
      postedAtRaw: normalizeScalar(input.postedAtRaw) || null,
      postedAtNormalized: parsePostedAt(input.postedAtNormalized || input.postedAtRaw),
      metadata: input.metadata,
      filterReasons: [],
      senioritySignals: [],
      skillKeywords: [],
      sponsorshipSignals: [],
    },
  });
}

export async function processStagedJob(
  db: IntakeDbClient,
  stagedJobId: string,
  options?: {
    autoAccept?: boolean;
  },
): Promise<StageAndProcessResult> {
  const stagedJob = await db.stagedJob.findUnique({
    where: { id: stagedJobId },
  });

  if (!stagedJob) {
    throw new Error(`Staged job not found: ${stagedJobId}`);
  }

  try {
    const normalized = normalizeStagedJob(stagedJob);
    const dedupe = await dedupeStagedJob(db, stagedJobId, stagedJob, normalized);
    const classification = classifyStagedJob(normalized, dedupe);
    const shouldAutoAccept =
      options?.autoAccept !== false &&
      classification.filterDecision === StagedJobDecision.ACCEPT;

    await db.stagedJob.update({
      where: { id: stagedJobId },
      data: {
        pipelineState:
          classification.filterDecision === StagedJobDecision.REJECT
            ? StagedJobStatus.REJECTED
            : classification.filterDecision === StagedJobDecision.REVIEW
            ? StagedJobStatus.REVIEW
            : shouldAutoAccept
            ? StagedJobStatus.PROCESSED
            : StagedJobStatus.PROCESSED,
        filterDecision: classification.filterDecision,
        filterReasons: classification.filterReasons,
        dedupeReason: dedupe.reason,
        duplicateOfJobId: dedupe.duplicateOfJobId,
        duplicateOfStagedJobId: dedupe.duplicateOfStagedJobId,
        processingError: null,
        normalizedTitle: normalized.normalizedTitle,
        normalizedCompany: normalized.normalizedCompany,
        normalizedLocation: normalized.normalizedLocation,
        workplaceType: normalized.workplaceType,
        cleanedText: normalized.cleanedText,
        yearsExperienceRequired: normalized.yearsExperienceRequired,
        yearsExperienceRaw: normalized.yearsExperienceRaw,
        seniorityBucket: normalized.seniorityBucket,
        senioritySignals: normalized.senioritySignals,
        skillKeywords: normalized.skillKeywords,
        sponsorshipSignals: normalized.sponsorshipSignals,
        normalizedRoleFamily: normalized.normalizedRoleFamily,
        descriptionHash: normalized.descriptionHash,
        postedAtNormalized: normalized.postedAtNormalized,
        freshnessBucket: normalized.freshnessBucket,
        freshnessDecisionReason: normalized.freshnessDecisionReason,
        openStatus: normalized.openStatus,
        openStatusReason: normalized.openStatusReason,
      },
    });

    const acceptedJob = shouldAutoAccept
      ? await acceptStagedJob(db, stagedJobId)
      : null;

    const refreshedStagedJob = await db.stagedJob.findUnique({
      where: { id: stagedJobId },
    });

    if (!refreshedStagedJob) {
      throw new Error(`Processed staged job not found: ${stagedJobId}`);
    }

    return {
      stagedJob: refreshedStagedJob,
      acceptedJob,
    };
  } catch (error) {
    await db.stagedJob.update({
      where: { id: stagedJobId },
      data: {
        pipelineState: StagedJobStatus.ERROR,
        processingError: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}

export async function stageAndProcessIncomingJob(
  db: IntakeDbClient,
  input: StageIncomingJobInput,
  options?: {
    autoAccept?: boolean;
  },
) {
  const stagedJob = await stageIncomingJob(db, input);
  return processStagedJob(db, stagedJob.id, options);
}

export function buildStagedJobInputFromNormalizedJob(
  normalizedJob: NormalizedJob,
  sourceName: string,
): StageIncomingJobInput {
  const metadata: Prisma.InputJsonObject = {
    applyUrl: normalizedJob.applyUrl || null,
    department: normalizedJob.department || null,
    sourceId: normalizedJob.sourceId,
    seenInLiveSource: true,
    preferredSkills: normalizedJob.preferredSkills,
    requiredSkills: normalizedJob.requiredSkills,
    remote: normalizedJob.remote,
  };

  return {
    sourceName,
    sourceType: mapSourceType(normalizedJob.sourceType),
    sourceUrl: normalizedJob.sourceUrl,
    canonicalUrl: normalizedJob.applyUrl || normalizedJob.sourceUrl,
    externalId: normalizedJob.sourceId,
    rawTitle: normalizedJob.title,
    rawCompany: normalizedJob.company,
    rawLocation: normalizedJob.location,
    rawDescription: normalizedJob.rawContent || normalizedJob.description || '',
    postedAtRaw: normalizedJob.postedDate
      ? normalizedJob.postedDate.toISOString()
      : null,
    postedAtNormalized: normalizedJob.postedDate || null,
    workplaceTypeRaw: normalizedJob.workplaceType,
    metadata,
  };
}
