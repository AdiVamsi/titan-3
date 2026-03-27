/**
 * Lever job board adapter
 * Handles ingestion from Lever API and application submission
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

interface LeverCategory {
  text: string;
  id: string;
}

interface LeverList {
  text: string;
  id: string;
}

interface LeverAdditional {
  name: string;
  value: unknown;
}

interface LeverJob {
  id: string;
  title: string;
  description: string;
  content: string;
  categories?: Record<string, string>;
  lists?: LeverList[];
  additional?: LeverAdditional[];
  createdAt?: number;
  updatedAt?: number;
  posting_creation_ts?: number;
  url?: string;
  applyUrl?: string;
}

interface LeverResponse {
  postings: LeverJob[];
}

export class LeverAdapter extends BaseAdapter {
  id = 'lever';
  name = 'Lever';
  sourceType = SourceType.LEVER;

  capabilities: AdapterCapabilities = {
    canIngest: true,
    canApply: true,
    canPrefill: false,
    requiresHumanReview: true,
    supportsResumeUpload: true,
    supportsQuestionHandling: true,
    notes: 'Uses Lever public postings API and application endpoint',
  };

  /**
   * Ingest jobs from Lever postings API
   * Requires company name in config.boardUrl or environment variable
   */
  async ingest(config: IngestConfig): Promise<IngestResult> {
    this.validateIngestConfig(config);

    const jobs: NormalizedJob[] = [];
    const errors: string[] = [];

    try {
      const company = this.extractCompanyName(config.boardUrl);
      if (!company) {
        errors.push(
          'Lever company name required in config.boardUrl or LEVER_COMPANY env var',
        );
        return { jobs, errors };
      }

      const url = `https://api.lever.co/v0/postings/${company}?mode=json`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        errors.push(`Lever API error: ${response.status} ${response.statusText}`);
        return { jobs, errors };
      }

      const data: LeverResponse = await response.json();

      for (const leverJob of data.postings || []) {
        try {
          const normalized = this.normalizeJob(leverJob, company);
          jobs.push(normalized);
        } catch (err) {
          errors.push(
            `Failed to normalize Lever job ${leverJob.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      return { jobs, errors };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Unknown error in Lever ingest';
      errors.push(errorMsg);
      return { jobs, errors };
    }
  }

  /**
   * Apply to a Lever job
   * STUB: Full implementation requires Lever application API credentials and form handling
   * TODO: Implement actual application submission to Lever opportunity endpoint
   */
  async apply(job: NormalizedJob, payload: ApplyPayload): Promise<ApplyResult> {
    this.validateApplyCapability();

    // STUB IMPLEMENTATION
    try {
      const applicationEndpoint = `https://api.lever.co/v0/opportunities`;

      const formData = new FormData();
      formData.append('posting_id', job.sourceId);
      formData.append('name', 'Candidate Name'); // TODO: extract from payload
      formData.append('email', 'candidate@example.com'); // TODO: extract from payload
      formData.append('phone', '+1-000-000-0000'); // TODO: extract from payload
      formData.append('resume', new File([], 'resume.pdf')); // TODO: read from payload.resumePath
      formData.append('cover_letter', payload.coverLetter || ''); // TODO: extract properly

      // TODO: Add authentication (Lever requires API credentials)
      const response = await fetch(applicationEndpoint, {
        method: 'POST',
        body: formData,
        // headers: { 'Authorization': `Bearer ${LEVER_API_TOKEN}` },
      });

      if (!response.ok) {
        return {
          success: false,
          method: ApplyMethod.LEVER,
          message: `Lever application failed: ${response.status}. Manual review required.`,
        };
      }

      const result = await response.json();

      return {
        success: true,
        method: ApplyMethod.LEVER,
        message: 'Application submitted successfully to Lever',
        data: {
          applicationId: result.id,
          applicationUrl: job.sourceUrl,
          timestamp: new Date(),
        },
      };
    } catch (err) {
      return {
        success: false,
        method: ApplyMethod.LEVER,
        message: `Lever apply error: ${err instanceof Error ? err.message : 'Unknown error'}. Requires human review.`,
      };
    }
  }

  /**
   * Normalize Lever job to NormalizedJob
   */
  private normalizeJob(leverJob: LeverJob, company: string): NormalizedJob {
    const location = this.extractLocation(leverJob);
    const isRemote =
      location.toLowerCase().includes('remote') ||
      location.toLowerCase().includes('anywhere');

    return {
      id: this.generateJobId(leverJob.id),
      sourceType: SourceType.LEVER,
      sourceId: leverJob.id,
      sourceUrl:
        leverJob.url ||
        `https://jobs.lever.co/postings/${leverJob.id}`,
      title: leverJob.title,
      company,
      description: leverJob.content || leverJob.description || '',
      location,
      workplaceType: isRemote ? WorkplaceType.REMOTE : WorkplaceType.UNKNOWN,
      remote: isRemote,
      requiredSkills: [],
      preferredSkills: [],
      sponsorshipRequired: false,
      sponsorshipRisk: SponsorshipRisk.UNKNOWN,
      applyMethod: ApplyMethod.LEVER,
      applyUrl: leverJob.applyUrl || leverJob.url,
      rawContent: leverJob.content || leverJob.description || '',
      ingestedAt: new Date(),
      lastUpdated: new Date(leverJob.updatedAt || leverJob.posting_creation_ts || Date.now()),
      postedDate: leverJob.posting_creation_ts
        ? new Date(leverJob.posting_creation_ts)
        : undefined,
    };
  }

  /**
   * Extract location from Lever job
   */
  private extractLocation(leverJob: LeverJob): string {
    // Check categories for location
    if (leverJob.categories?.location) {
      return leverJob.categories.location;
    }

    // Check lists
    if (leverJob.lists && leverJob.lists.length > 0) {
      const locationList = leverJob.lists.find((l) =>
        l.text.toLowerCase().includes('location'),
      );
      if (locationList) return locationList.text;
    }

    return 'Unknown';
  }

  /**
   * Extract company name from URL or environment
   */
  private extractCompanyName(boardUrl?: string): string | null {
    if (boardUrl) {
      // Extract from URL like company.lever.co or just company name
      const match = boardUrl.match(/(?:https?:\/\/)?(?:jobs\.)?([^.]+)\.lever\.co|(.+)/);
      if (match?.[1]) return match[1];
      if (match?.[2]) return match[2];
    }
    return process.env.LEVER_COMPANY || null;
  }
}

export const leverAdapter = new LeverAdapter();
