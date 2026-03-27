/**
 * Claude/Anthropic provider implementation
 * Uses @anthropic-ai/sdk with claude-sonnet-4-20250514 as default
 */

import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AIProviderConfig, AIMessage, AIResponse } from './base';

export class ClaudeProvider implements AIProvider {
  name = 'claude';
  private client: Anthropic;
  private defaultModel = 'claude-sonnet-4-20250514';
  private defaultMaxTokens = 2048;
  private defaultTemperature = 0.7;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('Anthropic API key not provided and ANTHROPIC_API_KEY env var not set');
    }
    this.client = new Anthropic({ apiKey: key });
  }

  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async chat(
    messages: AIMessage[],
    config?: Partial<AIProviderConfig>
  ): Promise<AIResponse> {
    const model = config?.model || this.defaultModel;
    const maxTokens = config?.maxTokens || this.defaultMaxTokens;
    const temperature = config?.temperature ?? this.defaultTemperature;

    // Extract system message if present
    let systemMessage = '';
    const userMessages = messages.filter((msg) => {
      if (msg.role === 'system') {
        systemMessage = msg.content;
        return false;
      }
      return true;
    });

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemMessage || undefined,
        messages: userMessages.map((msg) => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        })),
      });

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

      if (!content) {
        throw new Error('No text content in Claude response');
      }

      return {
        content,
        provider: this.name,
        model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new Error(`Anthropic API Error: ${error.message} (${error.status})`);
      }
      throw error;
    }
  }
}

export function createClaudeProvider(apiKey?: string): AIProvider {
  return new ClaudeProvider(apiKey);
}
