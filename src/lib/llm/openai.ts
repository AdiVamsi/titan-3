import OpenAI from 'openai';

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_TOKENS = 128;

let openAIClient: OpenAI | null = null;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set on the server.');
  }

  if (!openAIClient) {
    openAIClient = new OpenAI({ apiKey });
  }

  return openAIClient;
}

function extractOpenAIText(response: OpenAI.Chat.Completions.ChatCompletion) {
  const content = response.choices[0]?.message?.content;

  if (typeof content === 'string' && content.trim()) {
    return content.replace(/\s+/g, ' ').trim();
  }

  throw new Error('OpenAI returned an unexpected response shape.');
}

export async function askOpenAI(prompt: string): Promise<string> {
  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: DEFAULT_OPENAI_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0,
      max_tokens: DEFAULT_MAX_TOKENS,
    });

    return extractOpenAIText(response);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(`OpenAI request failed: ${error.message}`);
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('OpenAI request failed.');
  }
}
