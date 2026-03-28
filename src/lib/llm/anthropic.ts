import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 128;

let anthropicClient: Anthropic | null = null;

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set on the server.');
  }

  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey });
  }

  return anthropicClient;
}

function extractClaudeText(response: Anthropic.Messages.Message) {
  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text) {
    return text;
  }

  throw new Error('Claude returned an unexpected response shape.');
}

export async function askClaude(prompt: string): Promise<string> {
  try {
    const response = await getAnthropicClient().messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: DEFAULT_MAX_TOKENS,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    return extractClaudeText(response);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new Error(`Anthropic request failed: ${error.message}`);
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Anthropic request failed.');
  }
}
