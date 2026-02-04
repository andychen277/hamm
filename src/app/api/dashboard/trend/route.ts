import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get('range') || '6m';

  let interval: string;
  let groupBy: string;
  let dateFormat: string;

  switch (range) {
    case '7d':
      interval = '7 days';
      groupBy = 'day';
      dateFormat = 'YYYY-MM-DD';
      break;
    case '30d':
      interval = '30 days';
      groupBy = 'day';
      dateFormat = 'YYYY-MM-DD';
      break;
    case '6m':
      interval = '6 months';
      groupBy = 'month';
      dateFormat = 'YYYY-MM';
      break;
    case '1y':
      interval = '12 months';
      groupBy = 'month';
      dateFormat = 'YYYY-MM';
      break;
    default:
      interval = '6 months';
      groupBy = 'month';
      dateFormat = 'YYYY-MM';
  }

  try {
    const sql = groupBy === 'day'
      ? `SELECT
           TO_CHAR(transaction_date, '${dateFormat}') as period,
           SUM(total) as revenue
         FROM member_transactions
         WHERE transaction_date >= CURRENT_DATE - INTERVAL '${interval}'
           AND transaction_type = '收銀'
         GROUP BY period
         ORDER BY period`
      : `SELECT
           TO_CHAR(transaction_date, '${dateFormat}') as period,
           SUM(total) as revenue
         FROM member_transactions
         WHERE transaction_date >= CURRENT_DATE - INTERVAL '${interval}'
           AND transaction_type = '收銀'
         GROUP BY period
         ORDER BY period`;

    const result = await query<{ period: string; revenue: string }>(sql);

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
