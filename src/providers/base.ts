/**
 * AI Provider abstraction layer
 * Defines interfaces for different AI providers (OpenAI, Claude, etc.)
 */

export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProvider {
  name: string;
  chat(messages: AIMessage[], config?: Partial<AIProviderConfig>): Promise<AIResponse>;
  isAvailable(): boolean;
}
