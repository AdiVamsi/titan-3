/**
 * Abstract base adapter interface and types
 * All job source adapters implement this interface
 */

import {
  NormalizedJob,
  SourceType,
  ApplyMethod,
  AdapterCapabilities,
  ApplyResult,
  IngestResult,
} from '../lib/types';

/**
 * Base interface all source adapters must implement
 */
export interface SourceAdapter {
  id: string;
  name: string;
  sourceType: SourceType;
  capabilities: AdapterCapabilities;

  /**
   * Ingest jobs from a source
   */
  ingest(config: IngestConfig): Promise<IngestResult>;

  /**
   * Apply to a job
   */
  apply(job: NormalizedJob, payload: ApplyPayload): Promise<ApplyResult>;

  /**
   * Prefill application form (optional)
   */
  prefill?(job: NormalizedJob): Promise<PrefillResult>;
}

/**
 * Configuration for ingestion operation
 */
export interface IngestConfig {
  query?: string;
  location?: string;
  maxResults?: number;
  boardUrl?: string;
}

/**
 * Payload for application operation
 */
export interface ApplyPayload {
  resumePath: string;
  coverLetter?: string;
  answers?: Record<string, string>;
  workAuth: string;
}

/**
 * Result of prefill operation
 */
export interface PrefillResult {
  success: boolean;
  url: string;
  message: string;
}

/**
 * Abstract base adapter class with common logic
 */
export abstract class BaseAdapter implements SourceAdapter {
  abstract id: string;
  abstract name: string;
  abstract sourceType: SourceType;
  abstract capabilities: AdapterCapabilities;

  abstract ingest(config: IngestConfig): Promise<IngestResult>;
  abstract apply(
    job: NormalizedJob,
    payload: ApplyPayload,
  ): Promise<ApplyResult>;

  /**
   * Optional prefill implementation
   */
  async prefill?(job: NormalizedJob): Promise<PrefillResult>;

  /**
   * Helper to validate ingest configuration
   */
  protected validateIngestConfig(config: IngestConfig): void {
    if (!this.capabilities.canIngest) {
      throw new Error(`Adapter ${this.id} does not support ingestion`);
    }
  }

  /**
   * Helper to validate apply capability
   */
  protected validateApplyCapability(): void {
    if (!this.capabilities.canApply) {
      throw new Error(`Adapter ${this.id} does not support applying`);
    }
  }

  /**
   * Helper to validate prefill capability
   */
  protected validatePrefillCapability(): void {
    if (!this.capabilities.canPrefill) {
      throw new Error(`Adapter ${this.id} does not support prefill`);
    }
  }

  /**
   * Generate a normalized job ID from source-specific ID
   */
  protected generateJobId(sourceId: string): string {
    return `${this.sourceType}-${sourceId}-${Date.now()}`;
  }
}
