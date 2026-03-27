/**
 * Health check endpoint
 * GET /api/health
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const timestamp = new Date().toISOString();
    return NextResponse.json(
      {
        status: 'ok',
        timestamp,
        version: '0.1.0',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Health Check Error]', error);
    return NextResponse.json(
      { status: 'error', message: 'Health check failed' },
      { status: 500 }
    );
  }
}
