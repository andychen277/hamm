import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

const STORE_COLORS: Record<string, string> = {
  '台南': '#FF6B35',
  '高雄': '#F7C948',
  '台中': '#2EC4B6',
  '台北': '#E71D73',
  '美術': '#9B5DE5',
};

export async function GET() {
  try {
    const monthStart = new Date().toISOString().substring(0, 7) + '-01';

    const result = await query<{ store: string; revenue: string; orders: string }>(
      `SELECT
         store,
         SUM(total) as revenue,
         COUNT(DISTINCT order_number) as orders
       FROM member_transactions
       WHERE transaction_date >= $1
         AND transaction_type = '銷貨'
         AND store IS NOT NULL
         AND store != ''
       GROUP BY store
       ORDER BY revenue DESC`,
      [monthStart]
    );

    const data = result.rows.map(row => ({
      name: row.store + '店',
      store: row.store,
      revenue: Number(row.revenue),
      orders: Number(row.orders),
      color: STORE_COLORS[row.store] || '#64748b',
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
