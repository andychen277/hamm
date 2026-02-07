import { NextResponse } from 'next/server';
import { getPendingReceiveShipments } from '@/lib/spec-query';

export async function GET() {
  try {
    const shipments = await getPendingReceiveShipments();

    return NextResponse.json({
      success: true,
      data: shipments,
    });
  } catch (error) {
    console.error('Pending receive error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
