import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get('range') || '6m';

  // Whitelist-based config to prevent SQL injection
  const RANGE_CONFIG: Record<string, { intervalDays: number; dateFormat: string }> = {
    '7d':  { intervalDays: 7,   dateFormat: 'YYYY-MM-DD' },
    '30d': { intervalDays: 30,  dateFormat: 'YYYY-MM-DD' },
    '6m':  { intervalDays: 180, dateFormat: 'YYYY-MM' },
    '1y':  { intervalDays: 365, dateFormat: 'YYYY-MM' },
  };

  const config = RANGE_CONFIG[range] || RANGE_CONFIG['6m'];

  try {
    const result = await query<{ period: string; revenue: string }>(
      `SELECT
         TO_CHAR(transaction_date, $1) as period,
         SUM(total) as revenue
       FROM member_transactions
       WHERE transaction_date >= CURRENT_DATE - $2::int * INTERVAL '1 day'
         AND transaction_type = '收銀'
       GROUP BY period
       ORDER BY period`,
      [config.dateFormat, config.intervalDays]
    );

    const data = result.rows.map(row => ({
      period: row.period,
      revenue: Number(row.revenue),
    }));

    return NextResponse.json({ success: true, data, range });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
