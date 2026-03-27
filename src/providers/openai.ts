/**
 * OpenAI provider implementation
 * Uses the openai npm package with gpt-4o-mini as default
 */

import OpenAI from 'openai';
import { AIProvider, AIProviderConfig, AIMessage, AIResponse } from './base';

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private client: OpenAI;
  private defaultModel = 'gpt-4o-mini';
  private defaultMaxTokens = 2048;
  private defaultTemperature = 0.7;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OpenAI API key not provided and OPENAI_API_KEY env var not set');
    }
    this.client = new OpenAI({ apiKey: key });
  }

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async chat(
    messages: AIMessage[],
    config?: Partial<AIProviderConfig>
  ): Promise<AIResponse> {
    const model = config?.model || this.defaultModel;
    const maxTokens = config?.maxTokens || this.defaultMaxTokens;
    const temperature = config?.temperature ?? this.defaultTemperature;

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        max_tokens: maxTokens,
        temperature,
      });

      const content = response.choices[0]?.message?.content || '';

      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      return {
        content,
        provider: this.name,
        model,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`OpenAI API Error: ${error.message} (${error.status})`);
      }
      throw error;
    }
  }
}

export function createOpenAIProvider(apiKey?: string): AIProvider {
  return new OpenAIProvider(apiKey);
}
