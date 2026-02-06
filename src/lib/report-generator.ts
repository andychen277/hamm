import { query } from './db';

export interface StoreReport {
  store: string;
  revenue: number;
  orders: number;
  avg_order: number;
}

export interface DailyReport {
  date: string;
  weekday: string;
  total_revenue: number;
  prev_day_revenue: number;
  revenue_change: number | null;
  month_cumulative: number;
  stores: StoreReport[];
  new_members: number;
  new_line_bindings: number;
  returning_members: number;
  active_repairs: number;
  pending_orders: number;
  completed_repairs: number;
}

export interface WeeklyReport {
  week_start: string;
  week_end: string;
  total_revenue: number;
  prev_week_revenue: number;
  revenue_change: number | null;
  stores: StoreReport[];
  top_products: { product_name: string; quantity: number; revenue: number }[];
  new_members: number;
  active_members: number;
}

export interface StoreRevenueComparison {
  store: string;
  saleprodquery: number;  // 全部營收（含非會員、二手車等）
  member_only: number;    // 會員收銀營收
  diff: number;           // 差額（非會員 + 二手車 + 折讓等）
}

export interface MonthlyReport {
  month: string;
  total_revenue: number;
  total_revenue_member_only: number;
  prev_month_revenue: number;
  revenue_change: number | null;
  yoy_revenue: number | null;
  yoy_change: number | null;
  stores: StoreReport[];
  store_comparison: StoreRevenueComparison[];
  top_products: { product_name: string; quantity: number; revenue: number }[];
  member_growth: number;
  total_members: number;
  level_distribution: { level: string; count: number }[];
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const ALL_STORES = ['台南', '高雄', '台中', '台北', '美術'];

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

async function getStoreRevenue(dateFrom: string, dateTo: string): Promise<StoreReport[]> {
  const result = await query<{ store: string; revenue: string; orders: string; avg_order: string }>(
    `SELECT store,
            SUM(total) as revenue,
            COUNT(DISTINCT order_number) as orders,
            COALESCE(AVG(sub.order_total), 0) as avg_order
     FROM member_transactions mt
     LEFT JOIN LATERAL (
       SELECT SUM(total) as order_total
       FROM member_transactions
       WHERE order_number = mt.order_number AND transaction_type = '收銀'
       GROUP BY order_number
     ) sub ON true
     WHERE mt.transaction_date >= $1 AND mt.transaction_date < $2
       AND mt.transaction_type = '收銀'
       AND mt.store IS NOT NULL AND mt.store != ''
     GROUP BY store
     ORDER BY revenue DESC`,
    [dateFrom, dateTo]
  );

  // Build a map from query results
  const storeMap = new Map(result.rows.map(r => [r.store, {
    store: r.store,
    revenue: Number(r.revenue),
    orders: Number(r.orders),
    avg_order: Number(r.avg_order),
  }]));

  // Ensure all stores are included, even with 0 revenue
  const allStoreResults = ALL_STORES.map(store => storeMap.get(store) || {
    store,
    revenue: 0,
    orders: 0,
    avg_order: 0,
  });

  // Sort by revenue descending
  return allStoreResults.sort((a, b) => b.revenue - a.revenue);
}

async function getTopProducts(dateFrom: string, dateTo: string, limit = 10) {
  const result = await query<{ product_name: string; quantity: string; revenue: string }>(
    `SELECT product_name,
            SUM(quantity) as quantity,
            SUM(total) as revenue
     FROM member_transactions
     WHERE transaction_date >= $1 AND transaction_date < $2
       AND transaction_type = '收銀'
       AND product_name IS NOT NULL AND product_name != ''
     GROUP BY product_name
     ORDER BY revenue DESC
     LIMIT $3`,
    [dateFrom, dateTo, limit]
  );
  return result.rows.map(r => ({
    product_name: r.product_name,
    quantity: Number(r.quantity),
    revenue: Number(r.revenue),
  }));
}

export async function generateDailyReport(dateStr: string): Promise<DailyReport> {
  const date = new Date(dateStr);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const prevDay = new Date(date);
  prevDay.setDate(prevDay.getDate() - 1);
  const monthStart = dateStr.substring(0, 7) + '-01';

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  const [todayRev, prevDayRev, monthCum, stores, newMembers, repairs, orders, completedRepairs] = await Promise.all([
    query<{ total: string }>(`SELECT COALESCE(SUM(total),0) as total FROM member_transactions WHERE transaction_date = $1 AND transaction_type = '收銀'`, [dateStr]),
    query<{ total: string }>(`SELECT COALESCE(SUM(total),0) as total FROM member_transactions WHERE transaction_date = $1 AND transaction_type = '收銀'`, [fmt(prevDay)]),
    query<{ total: string }>(`SELECT COALESCE(SUM(total),0) as total FROM member_transactions WHERE transaction_date >= $1 AND transaction_date <= $2 AND transaction_type = '收銀'`, [monthStart, dateStr]),
    getStoreRevenue(dateStr, fmt(nextDay)),
    query<{ count: string }>(`SELECT COUNT(*) as count FROM unified_members WHERE created_at::date = $1`, [dateStr]),
    query<{ count: string }>(`SELECT COUNT(*) as count FROM repair_status_log WHERE last_known_status NOT IN ('completed','已完修','已取車')`),
    query<{ count: string }>(`SELECT COUNT(*) as count FROM order_status_log WHERE last_known_status IN ('pending','已訂未到','未到貨')`),
    query<{ count: string }>(`SELECT COUNT(*) as count FROM repair_status_log WHERE last_known_status IN ('completed','已完修') AND updated_at::date = $1`, [dateStr]),
  ]);

  const todayRevNum = Number(todayRev.rows[0].total);
  const prevDayRevNum = Number(prevDayRev.rows[0].total);

  return {
    date: dateStr,
    weekday: WEEKDAYS[date.getDay()],
    total_revenue: todayRevNum,
    prev_day_revenue: prevDayRevNum,
    revenue_change: pctChange(todayRevNum, prevDayRevNum),
    month_cumulative: Number(monthCum.rows[0].total),
    stores,
    new_members: Number(newMembers.rows[0].count),
    new_line_bindings: 0,
    returning_members: 0,
    active_repairs: Number(repairs.rows[0].count),
    pending_orders: Number(orders.rows[0].count),
    completed_repairs: Number(completedRepairs.rows[0].count),
  };
}

export async function generateWeeklyReport(dateStr: string): Promise<WeeklyReport> {
  const date = new Date(dateStr);
  // Get Monday of the week
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  const [thisWeekRev, prevWeekRev, stores, topProducts, newMembers, activeMembers] = await Promise.all([
    query<{ total: string }>(`SELECT COALESCE(SUM(total),0) as total FROM member_transactions WHERE transaction_date >= $1 AND transaction_date < $2 AND transaction_type = '收銀'`, [fmt(monday), fmt(sunday)]),
    query<{ total: string }>(`SELECT COALESCE(SUM(total),0) as total FROM member_transactions WHERE transaction_date >= $1 AND transaction_date < $2 AND transaction_type = '收銀'`, [fmt(prevMonday), fmt(monday)]),
    getStoreRevenue(fmt(monday), fmt(sunday)),
    getTopProducts(fmt(monday), fmt(sunday)),
    query<{ count: string }>(`SELECT COUNT(*) as count FROM unified_members WHERE created_at >= $1 AND created_at < $2`, [fmt(monday), fmt(sunday)]),
    query<{ count: string }>(`SELECT COUNT(DISTINCT member_phone) as count FROM member_transactions WHERE transaction_date >= $1 AND transaction_date < $2 AND transaction_type = '收銀'`, [fmt(monday), fmt(sunday)]),
  ]);

  const thisWeekRevNum = Number(thisWeekRev.rows[0].total);
  const prevWeekRevNum = Number(prevWeekRev.rows[0].total);

  return {
    week_start: fmt(monday),
    week_end: fmt(new Date(sunday.getTime() - 86400000)),
    total_revenue: thisWeekRevNum,
    prev_week_revenue: prevWeekRevNum,
    revenue_change: pctChange(thisWeekRevNum, prevWeekRevNum),
    stores,
    top_products: topProducts,
    new_members: Number(newMembers.rows[0].count),
    active_members: Number(activeMembers.rows[0].count),
  };
}

export async function generateMonthlyReport(dateStr: string): Promise<MonthlyReport> {
  const month = dateStr.substring(0, 7);
  const monthStart = month + '-01';
  const nextMonth = new Date(monthStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const prevMonth = new Date(monthStart);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const lastYearMonth = new Date(monthStart);
  lastYearMonth.setFullYear(lastYearMonth.getFullYear() - 1);
  const lastYearNextMonth = new Date(nextMonth);
  lastYearNextMonth.setFullYear(lastYearNextMonth.getFullYear() - 1);

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  const [thisMonthRev, memberOnlyRev, prevMonthRev, yoyRev, stores, srdStores, topProducts, memberGrowth, totalMembers, levels] = await Promise.all([
    // Primary: store_revenue_daily (saleprodquery), fallback to member_transactions
    query<{ total: string }>(`SELECT COALESCE(
      (SELECT SUM(revenue) FROM store_revenue_daily WHERE revenue_date >= $1 AND revenue_date < $2),
      (SELECT SUM(total) FROM member_transactions WHERE transaction_date >= $1 AND transaction_date < $2 AND transaction_type = '收銀')
    ) as total`, [monthStart, fmt(nextMonth)]),
    // Member-only revenue (收銀)
    query<{ total: string }>(`SELECT COALESCE(SUM(total),0) as total FROM member_transactions WHERE transaction_date >= $1 AND transaction_date < $2 AND transaction_type = '收銀'`, [monthStart, fmt(nextMonth)]),
    query<{ total: string }>(`SELECT COALESCE(
      (SELECT SUM(revenue) FROM store_revenue_daily WHERE revenue_date >= $1 AND revenue_date < $2),
      (SELECT SUM(total) FROM member_transactions WHERE transaction_date >= $1 AND transaction_date < $2 AND transaction_type = '收銀')
    ) as total`, [fmt(prevMonth), monthStart]),
    query<{ total: string }>(`SELECT COALESCE(SUM(total),0) as total FROM member_transactions WHERE transaction_date >= $1 AND transaction_date < $2 AND transaction_type = '收銀'`, [fmt(lastYearMonth), fmt(lastYearNextMonth)]),
    getStoreRevenue(monthStart, fmt(nextMonth)),
    // store_revenue_daily per store
    query<{ store: string; revenue: string }>(`SELECT store, SUM(revenue) as revenue FROM store_revenue_daily WHERE revenue_date >= $1 AND revenue_date < $2 GROUP BY store ORDER BY revenue DESC`, [monthStart, fmt(nextMonth)]),
    getTopProducts(monthStart, fmt(nextMonth)),
    query<{ count: string }>(`SELECT COUNT(*) as count FROM unified_members WHERE created_at >= $1 AND created_at < $2`, [monthStart, fmt(nextMonth)]),
    query<{ count: string }>(`SELECT COUNT(*) as count FROM unified_members`),
    query<{ level: string; count: string }>(`SELECT member_level as level, COUNT(*) as count FROM unified_members GROUP BY member_level ORDER BY count DESC`),
  ]);

  const thisMonthRevNum = Number(thisMonthRev.rows[0].total);
  const memberOnlyRevNum = Number(memberOnlyRev.rows[0].total);
  const prevMonthRevNum = Number(prevMonthRev.rows[0].total);
  const yoyRevNum = Number(yoyRev.rows[0].total);

  // Build store comparison: saleprodquery vs member_transactions
  const srdMap = new Map(srdStores.rows.map(r => [r.store, Number(r.revenue)]));
  const memberMap = new Map(stores.map(s => [s.store, s.revenue]));
  const allStoreNames = [...new Set([...srdMap.keys(), ...memberMap.keys()])];
  const storeComparison: StoreRevenueComparison[] = allStoreNames.map(store => {
    const sp = srdMap.get(store) || 0;
    const mo = memberMap.get(store) || 0;
    return { store, saleprodquery: sp, member_only: mo, diff: sp - mo };
  }).sort((a, b) => b.saleprodquery - a.saleprodquery);

  // Use saleprodquery stores if available, otherwise member_transactions stores
  // Ensure all stores are included
  const srdStoreMap = new Map(srdStores.rows.map(r => [r.store, Number(r.revenue)]));
  const memberStoreMap = new Map(stores.map(s => [s.store, s]));

  const finalStores = ALL_STORES.map(store => {
    const srdRevenue = srdStoreMap.get(store);
    const memberData = memberStoreMap.get(store);
    if (srdRevenue !== undefined) {
      return { store, revenue: srdRevenue, orders: memberData?.orders || 0, avg_order: memberData?.avg_order || 0 };
    } else if (memberData) {
      return memberData;
    } else {
      return { store, revenue: 0, orders: 0, avg_order: 0 };
    }
  }).sort((a, b) => b.revenue - a.revenue);

  return {
    month,
    total_revenue: thisMonthRevNum,
    total_revenue_member_only: memberOnlyRevNum,
    prev_month_revenue: prevMonthRevNum,
    revenue_change: pctChange(thisMonthRevNum, prevMonthRevNum),
    yoy_revenue: yoyRevNum,
    yoy_change: pctChange(thisMonthRevNum, yoyRevNum),
    stores: finalStores,
    store_comparison: storeComparison,
    top_products: topProducts,
    member_growth: Number(memberGrowth.rows[0].count),
    total_members: Number(totalMembers.rows[0].count),
    level_distribution: levels.rows.map(r => ({ level: r.level, count: Number(r.count) })),
  };
}
