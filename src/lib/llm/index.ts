import { askClaude } from './anthropic';
import { askOpenAI } from './openai';

export type LLMProviderName = 'openai' | 'anthropic';

export function normalizeLLMText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

export async function askLLM(
  provider: LLMProviderName,
  prompt: string,
): Promise<string> {
  const reply =
    provider === 'openai'
      ? await askOpenAI(prompt)
      : await askClaude(prompt);

  return normalizeLLMText(reply);
}

export {
  askClaude,
  askOpenAI,
};
