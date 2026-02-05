import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// 取得本週一的日期
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// 格式化日期為 YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// 計算日期範圍
function getDateRange(period: string): { start: string; end: string; label: string } {
  const today = new Date();
  const todayStr = formatDate(today);

  switch (period) {
    case 'today': {
      return { start: todayStr, end: todayStr, label: '今日營收' };
    }
    case 'this-week': {
      const monday = getMonday(today);
      return { start: formatDate(monday), end: todayStr, label: '本週營收' };
    }
    case 'last-week': {
      const thisMonday = getMonday(today);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(lastMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(lastSunday.getDate() - 1);
      return { start: formatDate(lastMonday), end: formatDate(lastSunday), label: '上週營收' };
    }
    case 'this-month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: formatDate(monthStart), end: todayStr, label: '本月營收' };
    }
    case 'last-month': {
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: formatDate(lastMonthStart), end: formatDate(lastMonthEnd), label: '上月營收' };
    }
    default:
      return { start: todayStr, end: todayStr, label: '營收' };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ period: string }> }
) {
  try {
    const { period } = await params;
    const { start, end, label } = getDateRange(period);

    // 各門市營收
    const storeResult = await query<{ store: string; revenue: string }>(
      `SELECT store, COALESCE(SUM(revenue), 0) as revenue
       FROM store_revenue_daily
       WHERE revenue_date >= $1 AND revenue_date <= $2
       GROUP BY store
       ORDER BY revenue DESC`,
      [start, end]
    );

    // 總營收
    const totalResult = await query<{ total: string }>(
      `SELECT COALESCE(SUM(revenue), 0) as total
       FROM store_revenue_daily
       WHERE revenue_date >= $1 AND revenue_date <= $2`,
      [start, end]
    );

    const stores = storeResult.rows.map(row => ({
      store: row.store,
      revenue: Number(row.revenue),
    }));

    return NextResponse.json({
      success: true,
      data: {
        period,
        label,
        start,
        end,
        total: Number(totalResult.rows[0]?.total || 0),
        stores,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
