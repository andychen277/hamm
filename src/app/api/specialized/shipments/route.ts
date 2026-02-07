import { NextRequest, NextResponse } from 'next/server';
import { getRecentShipments } from '@/lib/spec-query';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get('days')) || 30;

    const shipments = await getRecentShipments(Math.min(days, 180));

    return NextResponse.json({
      success: true,
      data: shipments,
    });
  } catch (error) {
    console.error('Spec shipments error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
