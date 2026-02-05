import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// 取得某日期範圍的營收
async function getRevenue(store: string, startDate: string, endDate: string): Promise<number> {
  const result = await query<{ total: string }>(
    `SELECT COALESCE(SUM(revenue), 0) as total
     FROM store_revenue_daily
     WHERE store = $1
       AND revenue_date >= $2
       AND revenue_date <= $3`,
    [store, startDate, endDate]
  );
  return Number(result.rows[0]?.total || 0);
}

// 取得本週一的日期
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 星期日時往回推6天
  return new Date(d.setDate(diff));
}

// 格式化日期為 YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  try {
    const { store } = await params;
    const storeName = decodeURIComponent(store);
    const { searchParams } = new URL(req.url);
    const customStart = searchParams.get('start_date');
    const customEnd = searchParams.get('end_date');

    const today = new Date();
    const todayStr = formatDate(today);

    // 本週一
    const thisMonday = getMonday(today);
    const thisMondayStr = formatDate(thisMonday);

    // 上週一和上週日
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(lastSunday.getDate() - 1);
    const lastMondayStr = formatDate(lastMonday);
    const lastSundayStr = formatDate(lastSunday);

    // 本月1號
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthStartStr = formatDate(thisMonthStart);

    // 上月1號和最後一天
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const lastMonthStartStr = formatDate(lastMonthStart);
    const lastMonthEndStr = formatDate(lastMonthEnd);

    // 並行查詢所有營收
    const [todayRevenue, thisWeekRevenue, lastWeekRevenue, thisMonthRevenue, lastMonthRevenue] = await Promise.all([
      getRevenue(storeName, todayStr, todayStr),
      getRevenue(storeName, thisMondayStr, todayStr),
      getRevenue(storeName, lastMondayStr, lastSundayStr),
      getRevenue(storeName, thisMonthStartStr, todayStr),
      getRevenue(storeName, lastMonthStartStr, lastMonthEndStr),
    ]);

    // 自訂日期查詢
    let customRevenue = null;
    if (customStart && customEnd) {
      customRevenue = {
        start: customStart,
        end: customEnd,
        revenue: await getRevenue(storeName, customStart, customEnd),
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        store: storeName,
        today: {
          date: todayStr,
          revenue: todayRevenue,
        },
        this_week: {
          start: thisMondayStr,
          end: todayStr,
          revenue: thisWeekRevenue,
        },
        last_week: {
          start: lastMondayStr,
          end: lastSundayStr,
          revenue: lastWeekRevenue,
        },
        this_month: {
          start: thisMonthStartStr,
          end: todayStr,
          revenue: thisMonthRevenue,
        },
        last_month: {
          start: lastMonthStartStr,
          end: lastMonthEndStr,
          revenue: lastMonthRevenue,
        },
        custom: customRevenue,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
