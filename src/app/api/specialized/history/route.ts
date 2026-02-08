import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query(
      `SELECT r.id, r.order_no, r.store, r.staff_name, r.total_items, r.total_qty, r.note,
              TO_CHAR(r.created_at, 'YYYY-MM-DD HH24:MI') as created_at
       FROM receiving_orders r
       WHERE r.supplier ILIKE '%specialized%'
       ORDER BY r.created_at DESC
       LIMIT 50`
    );

    // Get items for each order
    const orders = await Promise.all(
      result.rows.map(async (row) => {
        const items = await query(
          `SELECT product_id, product_name, quantity, price
           FROM receiving_items WHERE receiving_order_id = $1`,
          [row.id]
        );
        return { ...row, items: items.rows };
      })
    );

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error('Specialized history error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
