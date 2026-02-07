import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await query(
      `SELECT s.*,
              TO_CHAR(s.date_shipped, 'YYYY-MM-DD') as date_shipped_fmt,
              TO_CHAR(s.created_at, 'YYYY-MM-DD HH24:MI') as created_at_fmt,
              TO_CHAR(s.updated_at, 'YYYY-MM-DD HH24:MI') as updated_at_fmt,
              r.id as receiving_order_id,
              r.order_no as receiving_order_no,
              TO_CHAR(r.created_at, 'YYYY-MM-DD HH24:MI') as received_at
       FROM spec_shipments s
       LEFT JOIN receiving_orders r
         ON r.supplier ILIKE '%specialized%'
         AND r.note ILIKE '%' || s.shipment_id || '%'
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '找不到此出貨單' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Shipment detail error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
