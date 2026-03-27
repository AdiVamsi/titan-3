/**
 * Adapter registry - centralized registry of all job source adapters
 * Provides lookup and initialization of adapters
 */

import { SourceAdapter } from './base';
import { GreenhouseAdapter } from './greenhouse';
import { LeverAdapter } from './lever';
import { SourceType } from '../lib/types';

/**
 * Registry of all available adapters
 */
const adapterRegistry: Map<string, SourceAdapter> = new Map();

/**
 * Initialize registry with all adapters
 */
export function initializeAdapterRegistry(): void {
  const greenHouse = new GreenhouseAdapter();
  const lever = new LeverAdapter();

  adapterRegistry.set(greenHouse.id, greenHouse);
  adapterRegistry.set(lever.id, lever);
}

/**
 * Get adapter by ID
 */
export function getAdapterById(adapterId: string): SourceAdapter | undefined {
  return adapterRegistry.get(adapterId);
}

/**
 * Get adapter by source type
 */
export function getAdapterBySourceType(sourceType: SourceType): SourceAdapter | undefined {
  for (const adapter of adapterRegistry.values()) {
    if (adapter.sourceType === sourceType) {
      return adapter;
    }
  }
  return undefined;
}

/**
 * Get all registered adapters
 */
export function getAllAdapters(): SourceAdapter[] {
  return Array.from(adapterRegistry.values());
}

/**
 * Get all adapter capabilities for listing
 */
export function getAdapterCapabilities() {
  return Array.from(adapterRegistry.values()).map((adapter) => ({
    id: adapter.id,
    name: adapter.name,
    sourceType: adapter.sourceType,
    capabilities: adapter.capabilities,
  }));
}

// Initialize on import
initializeAdapterRegistry();
