import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = searchParams.get('end') || new Date().toISOString().split('T')[0];
    const q = searchParams.get('q') || '';
    const store = searchParams.get('store');

    let sql = `
      SELECT
        product_id,
        product_name,
        SUM(quantity) as total_quantity,
        SUM(total) as total_revenue,
        ROUND(AVG(price)::numeric, 0) as avg_price,
        STRING_AGG(DISTINCT store, ', ') as stores
      FROM member_transactions
      WHERE transaction_date >= $1
        AND transaction_date <= $2
        AND transaction_type = '收銀'
    `;

    const params: (string | number)[] = [start, end];
    let paramIndex = 3;

    if (q) {
      sql += ` AND product_name ILIKE $${paramIndex}`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    if (store && store !== 'all') {
      sql += ` AND store = $${paramIndex}`;
      params.push(store);
      paramIndex++;
    }

    sql += `
      GROUP BY product_id, product_name
      ORDER BY total_revenue DESC
      LIMIT 100
    `;

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      data: result.rows.map(r => ({
        product_id: r.product_id,
        product_name: r.product_name,
        total_quantity: Number(r.total_quantity),
        total_revenue: Number(r.total_revenue),
        avg_price: Number(r.avg_price),
        stores: r.stores,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
