/**
 * Manual import adapter
 * Allows users to manually input job descriptions and URLs
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

export interface ManualIngestConfig extends IngestConfig {
  title: string;
  company: string;
  description: string;
  url: string;
  location?: string;
  remote?: boolean;
}

export class ManualAdapter extends BaseAdapter {
  id = 'manual';
  name = 'Manual Import';
  sourceType = SourceType.MANUAL;

  capabilities: AdapterCapabilities = {
    canIngest: true,
    canApply: false,
    canPrefill: false,
    requiresHumanReview: true,
    supportsResumeUpload: false,
    supportsQuestionHandling: false,
    notes:
      'Allows manual JD entry. Applications must be handled manually or through other adapters.',
  };

  /**
   * Ingest a manually provided job posting
   * Expects extended config with title, company, description, url
   */
  async ingest(config: IngestConfig): Promise<IngestResult> {
    this.validateIngestConfig(config);

    const jobs: NormalizedJob[] = [];
    const errors: string[] = [];

    try {
      const manualConfig = config as ManualIngestConfig;

      // Validate required fields
      if (!manualConfig.title) {
        errors.push('Manual import requires title');
        return { jobs, errors };
      }
      if (!manualConfig.company) {
        errors.push('Manual import requires company');
        return { jobs, errors };
      }
      if (!manualConfig.description) {
        errors.push('Manual import requires description');
        return { jobs, errors };
      }
      if (!manualConfig.url) {
        errors.push('Manual import requires url');
        return { jobs, errors };
      }

      const job = this.normalizeJob(manualConfig);
      jobs.push(job);

      return { jobs, errors };
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Unknown error in manual import';
      errors.push(errorMsg);
      return { jobs, errors };
    }
  }

  /**
   * Apply to a manually imported job
   * Returns failure - users must apply manually or use another adapter
   */
  async apply(job: NormalizedJob, payload: ApplyPayload): Promise<ApplyResult> {
    return {
      success: false,
      method: ApplyMethod.MANUAL,
      message: `Manual imports cannot be auto-applied. Opening ${job.sourceUrl} for manual application.`,
      data: {
        applicationUrl: job.sourceUrl,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Normalize manually provided job to NormalizedJob
   */
  private normalizeJob(config: ManualIngestConfig): NormalizedJob {
    const location = config.location || 'Not specified';
    const isRemote = config.remote ?? location.toLowerCase().includes('remote');

    const sourceId = `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      id: this.generateJobId(sourceId),
      sourceType: SourceType.MANUAL,
      sourceId,
      sourceUrl: config.url,
      title: config.title,
      company: config.company,
      description: config.description,
      location,
      workplaceType: isRemote ? WorkplaceType.REMOTE : WorkplaceType.UNKNOWN,
      remote: isRemote,
      requiredSkills: [],
      preferredSkills: [],
      sponsorshipRequired: false,
      sponsorshipRisk: SponsorshipRisk.UNKNOWN,
      applyMethod: ApplyMethod.MANUAL,
      applyUrl: config.url,
      rawContent: config.description,
      ingestedAt: new Date(),
      lastUpdated: new Date(),
    };
  }
}

export const manualAdapter = new ManualAdapter();
