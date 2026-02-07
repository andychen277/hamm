import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try spec_orders first, fallback to spec_pending_orders
    let result = await query(
      `SELECT *, 'order' as source_type,
              TO_CHAR(order_date, 'YYYY-MM-DD') as order_date_fmt,
              TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at_fmt,
              TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI') as updated_at_fmt
       FROM spec_orders WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      result = await query(
        `SELECT *, 'pending' as source_type,
                TO_CHAR(submitted_date, 'YYYY-MM-DD') as submitted_date_fmt,
                TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at_fmt,
                TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI') as updated_at_fmt
         FROM spec_pending_orders WHERE id = $1`,
        [id]
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '找不到此訂單' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Order detail error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
