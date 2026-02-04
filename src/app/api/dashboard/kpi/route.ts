import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    // Previous month for comparison
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const prevMonthStart = d.toISOString().substring(0, 7) + '-01';
    const prevMonthEnd = today.substring(0, 7) + '-01';

    // Yesterday for comparison
    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    const yesterday = yd.toISOString().split('T')[0];

    const [
      todayRevenue,
      yesterdayRevenue,
      monthRevenue,
      prevMonthRevenue,
      totalMembers,
      newMembersThisMonth,
      lineBindingRate,
      avgOrderValue,
      prevAvgOrderValue,
    ] = await Promise.all([
      // Today's revenue
      query<{ total: string }>(
        `SELECT COALESCE(SUM(total), 0) as total FROM member_transactions
         WHERE transaction_date = $1 AND transaction_type = '銷貨'`,
        [today]
      ),
      // Yesterday's revenue
      query<{ total: string }>(
        `SELECT COALESCE(SUM(total), 0) as total FROM member_transactions
         WHERE transaction_date = $1 AND transaction_type = '銷貨'`,
        [yesterday]
      ),
      // This month's revenue
      query<{ total: string }>(
        `SELECT COALESCE(SUM(total), 0) as total FROM member_transactions
         WHERE transaction_date >= $1 AND transaction_type = '銷貨'`,
        [monthStart]
      ),
      // Previous month's revenue
      query<{ total: string }>(
        `SELECT COALESCE(SUM(total), 0) as total FROM member_transactions
         WHERE transaction_date >= $1 AND transaction_date < $2 AND transaction_type = '銷貨'`,
        [prevMonthStart, prevMonthEnd]
      ),
      // Total members
      query<{ count: string }>('SELECT COUNT(*) as count FROM unified_members'),
      // New members this month
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM unified_members WHERE created_at >= $1`,
        [monthStart]
      ),
      // LINE binding rate
      query<{ total: string; bound: string }>(
        `SELECT COUNT(*) as total,
                COUNT(line_user_id) FILTER (WHERE line_user_id IS NOT NULL AND line_user_id != '') as bound
         FROM unified_members`
      ),
      // Average order value (this month)
      query<{ avg: string }>(
        `SELECT COALESCE(AVG(order_total), 0) as avg FROM (
           SELECT order_number, SUM(total) as order_total
           FROM member_transactions
           WHERE transaction_date >= $1 AND transaction_type = '銷貨'
           GROUP BY order_number
         ) sub`,
        [monthStart]
      ),
      // Average order value (previous month)
      query<{ avg: string }>(
        `SELECT COALESCE(AVG(order_total), 0) as avg FROM (
           SELECT order_number, SUM(total) as order_total
           FROM member_transactions
           WHERE transaction_date >= $1 AND transaction_date < $2 AND transaction_type = '銷貨'
           GROUP BY order_number
         ) sub`,
        [prevMonthStart, prevMonthEnd]
      ),
    ]);

    const todayRev = Number(todayRevenue.rows[0].total);
    const yesterdayRev = Number(yesterdayRevenue.rows[0].total);
    const monthRev = Number(monthRevenue.rows[0].total);
    const prevMonthRev = Number(prevMonthRevenue.rows[0].total);
    const total = Number(totalMembers.rows[0].count);
    const bound = Number(lineBindingRate.rows[0].bound);
    const avgOV = Number(avgOrderValue.rows[0].avg);
    const prevAvgOV = Number(prevAvgOrderValue.rows[0].avg);

    const pctChange = (current: number, previous: number) => {
      if (previous === 0) return null;
      return ((current - previous) / previous) * 100;
    };

    return NextResponse.json({
      success: true,
      data: {
        today_revenue: {
          value: todayRev,
          change: pctChange(todayRev, yesterdayRev),
          label: '今日營收',
          compare: 'vs 昨日',
        },
        month_revenue: {
          value: monthRev,
          change: pctChange(monthRev, prevMonthRev),
          label: '本月營收',
          compare: 'vs 上月',
        },
        total_members: {
          value: total,
          change: null,
          label: '總會員數',
          compare: '',
        },
        new_members: {
          value: Number(newMembersThisMonth.rows[0].count),
          change: null,
          label: '本月新會員',
          compare: '',
        },
        line_bindind_rate: {
          value: total > 0 ? (bound / total) * 100 : 0,
          change: null,
          label: 'LINE 綁定率',
          compare: `${bound} / ${total}`,
        },
        avg_order_value: {
          value: avgOV,
          change: pctChange(avgOV, prevAvgOV),
          label: '平均客單價',
          compare: 'vs 上月',
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
