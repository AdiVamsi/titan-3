/**
 * Core TypeScript types and interfaces for Titan-3 Review Console
 * Matches Prisma schema enums and extends with application-specific types
 */

// ============================================================================
// ENUMS (matching Prisma schema)
// ============================================================================

export enum JobStatus {
  NEW = 'NEW',
  REVIEWED = 'REVIEWED',
  APPLIED = 'APPLIED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
  INPROGRESS = 'INPROGRESS',
}

export enum SourceType {
  GREENHOUSE = 'GREENHOUSE',
  LEVER = 'LEVER',
  MANUAL = 'MANUAL',
  BROWSER = 'BROWSER',
  JOBBOARD = 'JOBBOARD',
  LINKEDIN = 'LINKEDIN',
  DIRECT = 'DIRECT',
}

export enum WorkplaceType {
  REMOTE = 'REMOTE',
  ONSITE = 'ONSITE',
  HYBRID = 'HYBRID',
  UNKNOWN = 'UNKNOWN',
}

export enum SponsorshipRisk {
  NONE = 'NONE',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  UNKNOWN = 'UNKNOWN',
}

export enum ApplyMethod {
  DIRECT = 'DIRECT',
  GREENHOUSE = 'GREENHOUSE',
  LEVER = 'LEVER',
  LINKEDIN = 'LINKEDIN',
  EMAIL = 'EMAIL',
  MANUAL = 'MANUAL',
  UNKNOWN = 'UNKNOWN',
}

// ============================================================================
// ADAPTER TYPES
// ============================================================================

export interface AdapterCapabilities {
  canIngest: boolean;
  canApply: boolean;
  canPrefill: boolean;
  requiresHumanReview: boolean;
  supportsResumeUpload: boolean;
  supportsQuestionHandling: boolean;
  notes?: string;
}

// ============================================================================
// JOB TYPES
// ============================================================================

export interface NormalizedJob {
  // Core fields
  id: string;
  sourceType: SourceType;
  sourceId: string;
  sourceUrl: string;
  title: string;
  company: string;
  companyUrl?: string;
  description: string;

  // Location & Work
  location: string;
  workplaceType: WorkplaceType;
  remote: boolean;

  // Details
  jobType?: string;
  level?: string;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };

  // Requirements
  requiredSkills: string[];
  preferredSkills: string[];
  yearsRequired?: number;

  // Sponsorship & Auth
  sponsorshipRequired: boolean;
  sponsorshipRisk: SponsorshipRisk;
  workAuthRequired?: string;

  // Metadata
  postedDate?: Date;
  deadline?: Date;
  department?: string;
  team?: string;
  reportingTo?: string;

  // Raw & Parsed content
  rawContent: string;
  parsedContent?: Record<string, unknown>;

  // Application
  applyMethod: ApplyMethod;
  applyUrl?: string;

  // Tracking
  ingestedAt: Date;
  lastUpdated: Date;
}

// ============================================================================
// SCORING TYPES
// ============================================================================

export interface ScoreBreakdown {
  roleFamily: string;
  familyConfidence: number;
  titleFit: number;
  skillsFit: number;
  seniorityFit: number;
  aiRelevance: number;
  backendRelevance: number;
  locationFit: number;
  sponsorshipRisk: number;
  priorityScore: number;
  positionabilityScore: number;
  riskLevel: string;
  pursuitRecommendation: string;
  overallScore: number;

  rationale: string;
  strategicRationale: string;
  positionabilityNote: string;
  riskFlags: string[];
  matchedSkills: string[];
  missingSkills: string[];
  matchedCoreSkills: string[];
  missingCoreSkills: string[];
  missingSecondarySkills: string[];
  incidentalMismatches: string[];
  keywordGaps: string[];
  relevantProjects: string[];
  risks: string[];
}

export interface ReviewPacketData {
  jobId: string;
  jobTitle: string;
  company: string;
  sourceUrl: string;

  // Scoring
  score: ScoreBreakdown;

  // Extracted content
  keyResponsibilities: string[];
  requiredQualifications: string[];
  niceToHave: string[];
  compensation: {
    salary?: string;
    bonus?: string;
    equity?: string;
    benefits?: string[];
  };

  // AI Analysis
  companyResearch?: string;
  draftOutreach?: string;

  // Metadata
  generatedAt: Date;
  aiProvider: AIProvider;
  status: JobStatus;
}

// ============================================================================
// APPLICATION RESULT TYPES
// ============================================================================

export interface ApplyResult {
  success: boolean;
  method: ApplyMethod;
  message: string;
  data?: {
    applicationId?: string;
    applicationUrl?: string;
    timestamp?: Date;
    confirmationEmail?: string;
  };
}

// ============================================================================
// INGESTION RESULT TYPES
// ============================================================================

export interface IngestResult {
  jobs: NormalizedJob[];
  errors: string[];
}

// ============================================================================
// AI TASK TYPES
// ============================================================================

export type AITask =
  | 'clean_jd'
  | 'score_job'
  | 'generate_packet'
  | 'draft_outreach'
  | 'company_research';

export type AIProvider = 'claude' | 'openai';
