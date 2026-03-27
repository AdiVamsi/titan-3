/**
 * Browser-assisted adapter using Playwright
 * Handles complex job board extraction and form prefilling
 * STUB: Requires Playwright integration and browser automation
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
import { BaseAdapter, IngestConfig, ApplyPayload, PrefillResult } from './base';

// STUB: Would use Playwright types when implemented
// import { Browser, Page } from 'playwright';

export class BrowserAdapter extends BaseAdapter {
  id = 'browser';
  name = 'Browser Assistant';
  sourceType = SourceType.JOBBOARD;

  capabilities: AdapterCapabilities = {
    canIngest: true,
    canApply: false,
    canPrefill: true,
    requiresHumanReview: true,
    supportsResumeUpload: false,
    supportsQuestionHandling: false,
    notes:
      'STUB: Uses Playwright to extract JD from web pages and prefill forms. Requires browser automation setup.',
  };

  /**
   * Ingest jobs from a URL using Playwright
   * STUB: Would navigate to URL and extract job details using Playwright
   * TODO: Implement Playwright integration
   */
  async ingest(config: IngestConfig): Promise<IngestResult> {
    this.validateIngestConfig(config);

    const jobs: NormalizedJob[] = [];
    const errors: string[] = [];

    // STUB IMPLEMENTATION
    try {
      if (!config.boardUrl) {
        errors.push('Browser adapter requires boardUrl in config');
        return { jobs, errors };
      }

      // TODO: Initialize Playwright
      // const browser = await chromium.launch();
      // const context = await browser.createBrowserContext();
      // const page = await context.newPage();

      // TODO: Navigate to URL
      // await page.goto(config.boardUrl);

      // TODO: Extract job details from DOM
      // const jobData = await page.evaluate(() => {
      //   return {
      //     title: document.querySelector('h1.job-title')?.textContent,
      //     description: document.querySelector('div.job-description')?.textContent,
      //     company: document.querySelector('span.company-name')?.textContent,
      //     location: document.querySelector('span.job-location')?.textContent,
      //   };
      // });

      // TODO: Normalize and return
      // const job = this.normalizeJob(jobData, config.boardUrl);
      // jobs.push(job);

      // TODO: Cleanup
      // await browser.close();

      errors.push(
        'Browser adapter is a STUB. Playwright integration not yet implemented.',
      );
      return { jobs, errors };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Unknown error in browser ingest';
      errors.push(`Browser ingest error (STUB): ${errorMsg}`);
      return { jobs, errors };
    }
  }

  /**
   * Apply to a job is not supported by browser adapter
   */
  async apply(job: NormalizedJob, payload: ApplyPayload): Promise<ApplyResult> {
    return {
      success: false,
      method: ApplyMethod.UNKNOWN,
      message:
        'Browser adapter does not support automatic application. Use prefill to open the form, then apply manually.',
    };
  }

  /**
   * Prefill application form using Playwright
   * STUB: Would navigate to apply URL and prefill known fields
   * TODO: Implement Playwright form prefilling
   */
  async prefill(job: NormalizedJob): Promise<PrefillResult> {
    this.validatePrefillCapability();

    // STUB IMPLEMENTATION
    try {
      if (!job.applyUrl) {
        return {
          success: false,
          url: job.sourceUrl,
          message: 'No application URL available for prefill',
        };
      }

      // TODO: Initialize Playwright
      // const browser = await chromium.launch();
      // const context = await browser.createBrowserContext();
      // const page = await context.newPage();

      // TODO: Navigate to apply page
      // await page.goto(job.applyUrl);

      // TODO: Detect form fields
      // const fields = await page.evaluate(() => {
      //   return Array.from(document.querySelectorAll('input, textarea, select')).map(el => ({
      //     name: (el as HTMLInputElement).name,
      //     type: (el as HTMLInputElement).type,
      //     id: (el as HTMLInputElement).id,
      //   }));
      // });

      // TODO: Prefill detected fields
      // for (const field of fields) {
      //   if (field.name?.includes('name')) {
      //     await page.fill(`[name="${field.name}"]`, 'Candidate Name');
      //   }
      //   if (field.name?.includes('email')) {
      //     await page.fill(`[name="${field.name}"]`, 'candidate@example.com');
      //   }
      //   // ... more field mappings
      // }

      // TODO: Wait for user manual interaction and cleanup
      // browser remains open for user to complete form manually
      // TODO: Add timeout and auto-close logic

      // TODO: Return filled form URL
      // await browser.close();

      return {
        success: false,
        url: job.applyUrl,
        message:
          'Browser prefill is a STUB. Playwright integration not yet implemented. Opening URL for manual application.',
      };
    } catch (err) {
      return {
        success: false,
        url: job.applyUrl || job.sourceUrl,
        message: `Browser prefill error (STUB): ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Normalize browser-extracted job to NormalizedJob
   * STUB: Would be called by ingest after Playwright extraction
   */
  private normalizeJob(data: Record<string, unknown>, sourceUrl: string): NormalizedJob {
    const sourceId = `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const location = (data.location as string) || 'Unknown';
    const isRemote = location.toLowerCase().includes('remote');

    return {
      id: this.generateJobId(sourceId),
      sourceType: SourceType.JOBBOARD,
      sourceId,
      sourceUrl,
      title: (data.title as string) || 'Unknown Title',
      company: (data.company as string) || 'Unknown Company',
      description: (data.description as string) || '',
      location,
      workplaceType: isRemote ? WorkplaceType.REMOTE : WorkplaceType.UNKNOWN,
      remote: isRemote,
      requiredSkills: [],
      preferredSkills: [],
      sponsorshipRequired: false,
      sponsorshipRisk: SponsorshipRisk.UNKNOWN,
      applyMethod: ApplyMethod.UNKNOWN,
      rawContent: (data.description as string) || '',
      ingestedAt: new Date(),
      lastUpdated: new Date(),
    };
  }
}

export const browserAdapter = new BrowserAdapter();
