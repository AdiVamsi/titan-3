/**
 * Adapters listing endpoint
 * GET /api/adapters - List all registered adapters with capabilities
 */

import { NextResponse } from 'next/server';
import { getAdapterCapabilities } from '@/adapters/registry';

export async function GET() {
  try {
    const adapters = getAdapterCapabilities();

    return NextResponse.json(
      {
        data: adapters,
        count: adapters.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Adapters List Error]', error);
    return NextResponse.json(
      { error: 'Failed to list adapters' },
      { status: 500 }
    );
  }
}
