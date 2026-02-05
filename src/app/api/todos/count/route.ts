import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/todos/count - Get pending todo count
export async function GET() {
  try {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM todos WHERE status = 'pending'`
    );

    return NextResponse.json({
      success: true,
      data: {
        pending_count: Number(result.rows[0].count),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
