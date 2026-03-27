/**
 * Provider router and orchestrator
 * Routes AI tasks to the most appropriate provider
 */

import { AIProvider, AIMessage } from './base';
import { OpenAIProvider, createOpenAIProvider } from './openai';
import { ClaudeProvider, createClaudeProvider } from './claude';
import { AITask } from '../lib/types';

// Provider instances cache
let openaiInstance: AIProvider | null = null;
let claudeInstance: AIProvider | null = null;

/**
 * Get a specific provider by name
 */
export function getProvider(name: 'claude' | 'openai'): AIProvider {
  if (name === 'openai') {
    if (!openaiInstance) {
      openaiInstance = createOpenAIProvider();
    }
    return openaiInstance;
  } else {
    if (!claudeInstance) {
      claudeInstance = createClaudeProvider();
    }
    return claudeInstance;
  }
}

/**
 * Get the best provider for a specific task
 * Includes fallback logic if primary provider is unavailable
 */
export function getProviderForTask(task: AITask): AIProvider {
  let preferred: 'claude' | 'openai';
  let fallback: 'claude' | 'openai';

  // Route based on task type
  switch (task) {
    case 'clean_jd':
      // High-volume, cost-effective
      preferred = 'openai';
      fallback = 'claude';
      break;

    case 'score_job':
      // First-pass scoring, high-volume
      preferred = 'openai';
      fallback = 'claude';
      break;

    case 'generate_packet':
      // Deep reasoning needed for review packets
      preferred = 'claude';
      fallback = 'openai';
      break;

    case 'draft_outreach':
      // Quality writing matters
      preferred = 'claude';
      fallback = 'openai';
      break;

    case 'company_research':
      // Bulk research, cost-effective
      preferred = 'openai';
      fallback = 'claude';
      break;

    default:
      preferred = 'claude';
      fallback = 'openai';
  }

  // Try preferred provider first
  try {
    const provider = getProvider(preferred);
    if (provider.isAvailable()) {
      return provider;
    }
  } catch {
    // Preferred provider not available, try fallback
  }

  // Fall back to alternative
  try {
    const provider = getProvider(fallback);
    if (provider.isAvailable()) {
      return provider;
    }
  } catch {
    // Fallback also unavailable
  }

  // If we get here, throw with helpful error
  throw new Error(
    `No AI providers available. Tried ${preferred} and ${fallback}. Check your API keys.`
  );
}

/**
 * Convenience function to run an AI task end-to-end
 */
export async function runAITask(
  task: AITask,
  prompt: string,
  context?: Record<string, string>
): Promise<string> {
  const provider = getProviderForTask(task);

  // Build messages with optional context
  const messages: AIMessage[] = [];

  // Add system message based on task
  const systemPrompts: Record<AITask, string> = {
    clean_jd: 'You are a job description cleaning expert. Extract and normalize job posting data.',
    score_job: 'You are a job scoring expert. Analyze job postings and provide structured scores.',
    generate_packet:
      'You are a thorough job analysis expert. Create detailed review packets with deep insights.',
    draft_outreach:
      'You are an excellent technical writer. Draft compelling, personalized outreach messages.',
    company_research: 'You are a research expert. Provide concise, relevant company research.',
  };

  messages.push({
    role: 'system',
    content: systemPrompts[task],
  });

  // Add context if provided
  if (context) {
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    messages.push({
      role: 'user',
      content: `Context:\n${contextStr}\n\nTask: ${prompt}`,
    });
  } else {
    messages.push({
      role: 'user',
      content: prompt,
    });
  }

  // Call provider
  const response = await provider.chat(messages);
  return response.content;
}

/**
 * Reset provider instances (useful for testing or credential rotation)
 */
export function resetProviders(): void {
  openaiInstance = null;
  claudeInstance = null;
}
