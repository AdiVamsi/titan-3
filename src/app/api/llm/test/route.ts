import { NextResponse } from 'next/server';

import { askClaude, askOpenAI, normalizeLLMText } from '@/lib/llm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEST_PROMPT = 'Reply with exactly: LLM connection working';

export async function GET() {
  try {
    const openaiReply = normalizeLLMText(await askOpenAI(TEST_PROMPT));
    const claudeReply = normalizeLLMText(await askClaude(TEST_PROMPT));

    return NextResponse.json(
      {
        ok: true,
        openaiReply,
        claudeReply,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[LLM Test Error]', error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown LLM test error.',
      },
      { status: 500 },
    );
  }
}
