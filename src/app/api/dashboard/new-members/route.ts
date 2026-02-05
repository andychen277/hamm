import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // Get new members by store for this month
    const thisMonthStart = new Date().toISOString().substring(0, 7) + '-01';
    
    // Get last 3 months for trend
    const months: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().substring(0, 7));
    }

    const [byStore, byMonth, recentMembers] = await Promise.all([
      // New members by store this month
      query<{ store: string; count: string }>(
        `SELECT store, COUNT(DISTINCT member_phone) as count FROM (
           SELECT member_phone, store, MIN(transaction_date) as first_date
           FROM member_transactions
           WHERE member_phone IS NOT NULL AND member_phone != ''
           GROUP BY member_phone, store
         ) sub
         WHERE first_date >= $1
         GROUP BY store
         ORDER BY count DESC`,
        [thisMonthStart]
      ),
      // New members by month for last 3 months
      query<{ month: string; store: string; count: string }>(
        `SELECT TO_CHAR(first_date, 'YYYY-MM') as month, store, COUNT(*) as count FROM (
           SELECT member_phone, store, MIN(transaction_date) as first_date
           FROM member_transactions
           WHERE member_phone IS NOT NULL AND member_phone != ''
           GROUP BY member_phone, store
         ) sub
         WHERE first_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '2 months')
         GROUP BY month, store
         ORDER BY month DESC, count DESC`
      ),
      // Recent new members (this month)
      query<{ phone: string; name: string; store: string; first_date: string; first_amount: string }>(
        `SELECT 
           sub.member_phone as phone,
           COALESCE(um.name, '未知') as name,
           sub.store,
           sub.first_date,
           sub.first_amount
         FROM (
           SELECT 
             member_phone, 
             store, 
             MIN(transaction_date) as first_date,
             (SELECT SUM(total) FROM member_transactions t2 
              WHERE t2.member_phone = mt.member_phone 
              AND t2.transaction_date = MIN(mt.transaction_date)) as first_amount
           FROM member_transactions mt
           WHERE member_phone IS NOT NULL AND member_phone != ''
           GROUP BY member_phone, store
         ) sub
         LEFT JOIN unified_members um ON um.phone = sub.member_phone
         WHERE sub.first_date >= $1
         ORDER BY sub.first_date DESC
         LIMIT 50`,
        [thisMonthStart]
      ),
    ]);

    // Calculate totals
    const thisMonthTotal = byStore.rows.reduce((sum, r) => sum + Number(r.count), 0);
    
    // Group by month for summary
    const monthlyTotals: Record<string, { total: number; stores: Record<string, number> }> = {};
    byMonth.rows.forEach(row => {
      if (!monthlyTotals[row.month]) {
        monthlyTotals[row.month] = { total: 0, stores: {} };
      }
      monthlyTotals[row.month].total += Number(row.count);
      monthlyTotals[row.month].stores[row.store] = Number(row.count);
    });

    return NextResponse.json({
      success: true,
      data: {
        this_month: {
          total: thisMonthTotal,
          by_store: byStore.rows.map(r => ({ store: r.store, count: Number(r.count) })),
        },
        monthly_trend: Object.entries(monthlyTotals).map(([month, data]) => ({
          month,
          total: data.total,
          stores: data.stores,
        })),
        recent_members: recentMembers.rows.map(r => ({
          phone: r.phone,
          name: r.name,
          store: r.store,
          first_date: r.first_date,
          first_amount: Number(r.first_amount) || 0,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
