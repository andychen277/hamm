import { NextResponse } from 'next/server';
import { getInventoryWithTransit, getLastSyncStatus } from '@/lib/spec-query';

export async function GET() {
  try {
    const data = await getInventoryWithTransit();
    const lastSync = await getLastSyncStatus();

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        lastSync,
      },
    });
  } catch (error) {
    console.error('In-transit query error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
