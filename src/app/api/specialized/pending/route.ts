import { NextResponse } from 'next/server';
import { getPendingOrders } from '@/lib/spec-query';

export async function GET() {
  try {
    const orders = await getPendingOrders();

    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('Pending orders error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
