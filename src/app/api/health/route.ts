import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query('SELECT NOW() as time');
    return NextResponse.json({
      status: 'ok',
      service: 'Hamm - 277 Business Intelligence',
      db: 'connected',
      time: result.rows[0].time,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      service: 'Hamm - 277 Business Intelligence',
      db: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
