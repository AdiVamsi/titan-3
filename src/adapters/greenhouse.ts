/**
 * Greenhouse job board adapter
 * Handles ingestion from Greenhouse API and application submission
 */

import {
  NormalizedJob,
  SourceType,
  ApplyMethod,
  ApplyResult,
  IngestResult,
  WorkplaceType,
  SponsorshipRisk,
  AdapterCapabilities,
} from '../lib/types';
import { BaseAdapter, IngestConfig, ApplyPayload } from './base';

interface GreenhouseJob {
  id: number;
  title: string;
  location?: {
    name: string;
  };
  content: string;
  departments?: Array<{ name: string }>;
  updated_at?: string;
  published_at?: string;
  absolute_url?: string;
  metadata?: Record<string, unknown>;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

export class GreenhouseAdapter extends BaseAdapter {
  id = 'greenhouse';
  name = 'Greenhouse';
  sourceType = SourceType.GREENHOUSE;

  capabilities: AdapterCapabilities = {
    canIngest: true,
    canApply: true,
    canPrefill: false,
    requiresHumanReview: true,
    supportsResumeUpload: true,
    supportsQuestionHandling: true,
    notes: 'Uses Greenhouse public job board API and application endpoint',
  };

  /**
   * Ingest jobs from Greenhouse job board API
   * Requires board token from config.boardUrl or environment
   */
  async ingest(config: IngestConfig): Promise<IngestResult> {
    this.validateIngestConfig(config);

    const jobs: NormalizedJob[] = [];
    const errors: string[] = [];

    try {
      const boardToken = this.extractBoardToken(config.boardUrl);
      if (!boardToken) {
        errors.push(
          'Greenhouse board token required in config.boardUrl or GREENHOUSE_BOARD_TOKEN env var',
        );
        return { jobs, errors };
      }

      const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        errors.push(
          `Greenhouse API error: ${response.status} ${response.statusText}`,
        );
        return { jobs, errors };
      }

      const data: GreenhouseResponse = await response.json();

      for (const ghJob of data.jobs) {
        try {
          const normalized = this.normalizeJob(ghJob);
          jobs.push(normalized);
        } catch (err) {
          errors.push(
            `Failed to normalize Greenhouse job ${ghJob.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      return { jobs, errors };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Unknown error in Greenhouse ingest';
      errors.push(errorMsg);
      return { jobs, errors };
    }
  }

  /**
   * Apply to a Greenhouse job
   * STUB: Full implementation requires Greenhouse application API credentials and form handling
   * TODO: Implement actual application submission to Greenhouse application endpoint
   */
  async apply(job: NormalizedJob, payload: ApplyPayload): Promise<ApplyResult> {
    this.validateApplyCapability();

    // STUB IMPLEMENTATION
    try {
      const applicationEndpoint = `https://api.greenhouse.io/v1/applications`;

      const formData = new FormData();
      formData.append('candidate_first_name', 'Candidate'); // TODO: extract from payload
      formData.append('candidate_last_name', 'Name'); // TODO: extract from payload
      formData.append('candidate_email', 'candidate@example.com'); // TODO: extract from payload
      formData.append('candidate_phone', '+1-000-000-0000'); // TODO: extract from payload
      formData.append('candidate_resume', new File([], 'resume.pdf')); // TODO: read from payload.resumePath
      formData.append('candidate_cover_letter', payload.coverLetter || ''); // TODO: extract properly
      formData.append('job_id', job.sourceId);

      // TODO: Add authentication headers (requires Greenhouse API key)
      const response = await fetch(applicationEndpoint, {
        method: 'POST',
        body: formData,
        // headers: { 'Authorization': `Bearer ${GREENHOUSE_API_KEY}` },
      });

      if (!response.ok) {
        return {
          success: false,
          method: ApplyMethod.GREENHOUSE,
          message: `Greenhouse application failed: ${response.status}. Manual review required.`,
        };
      }

      const result = await response.json();

      return {
        success: true,
        method: ApplyMethod.GREENHOUSE,
        message: 'Application submitted successfully to Greenhouse',
        data: {
          applicationId: result.id,
          applicationUrl: job.sourceUrl,
          timestamp: new Date(),
        },
      };
    } catch (err) {
      return {
        success: false,
        method: ApplyMethod.GREENHOUSE,
        message: `Greenhouse apply error: ${err instanceof Error ? err.message : 'Unknown error'}. Requires human review.`,
      };
    }
  }

  /**
   * Normalize Greenhouse job to NormalizedJob
   */
  private normalizeJob(ghJob: GreenhouseJob): NormalizedJob {
    const location = ghJob.location?.name || 'Unknown';
    const isRemote =
      location.toLowerCase().includes('remote') ||
      location.toLowerCase().includes('anywhere');

    return {
      id: this.generateJobId(String(ghJob.id)),
      sourceType: SourceType.GREENHOUSE,
      sourceId: String(ghJob.id),
      sourceUrl: ghJob.absolute_url || `https://boards.greenhouse.io/job/${ghJob.id}`,
      title: ghJob.title,
      company: 'Unknown', // TODO: extract from Greenhouse board metadata
      description: ghJob.content || '',
      location,
      workplaceType: isRemote ? WorkplaceType.REMOTE : WorkplaceType.UNKNOWN,
      remote: isRemote,
      requiredSkills: [],
      preferredSkills: [],
      sponsorshipRequired: false,
      sponsorshipRisk: SponsorshipRisk.UNKNOWN,
      applyMethod: ApplyMethod.GREENHOUSE,
      applyUrl: ghJob.absolute_url,
      department: ghJob.departments?.[0]?.name,
      rawContent: ghJob.content || '',
      ingestedAt: new Date(),
      lastUpdated: new Date(ghJob.updated_at || new Date()),
      postedDate: ghJob.published_at
        ? new Date(ghJob.published_at)
        : undefined,
    };
  }

  /**
   * Extract board token from URL or environment
   */
  private extractBoardToken(boardUrl?: string): string | null {
    if (boardUrl) {
      const trimmedBoardUrl = boardUrl.trim();

      if (!trimmedBoardUrl) {
        return process.env.GREENHOUSE_BOARD_TOKEN || null;
      }

      if (!trimmedBoardUrl.includes('://') && !trimmedBoardUrl.includes('/')) {
        return trimmedBoardUrl;
      }

      try {
        const parsedUrl = new URL(trimmedBoardUrl);
        const hostParts = parsedUrl.hostname.split('.');
        const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);

        if (hostParts.length > 2 && hostParts[1] === 'greenhouse') {
          return hostParts[0];
        }

        if (pathSegments.length > 0) {
          return pathSegments[pathSegments.length - 1];
        }
      } catch {
        const fallbackMatch = trimmedBoardUrl.match(/greenhouse\.io\/([^/?#]+)/i);
        if (fallbackMatch?.[1]) {
          return fallbackMatch[1];
        }
      }
    }

    return process.env.GREENHOUSE_BOARD_TOKEN || null;
  }
}

export const greenhouseAdapter = new GreenhouseAdapter();
