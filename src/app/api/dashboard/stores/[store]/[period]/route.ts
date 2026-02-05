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

// 根據 period 參數取得日期範圍
function getDateRange(period: string, customStart?: string, customEnd?: string): { start: string; end: string; label: string } {
  const today = new Date();
  const todayStr = formatDate(today);

  switch (period) {
    case 'today':
      return { start: todayStr, end: todayStr, label: '今日' };

    case 'this-week': {
      const thisMonday = getMonday(today);
      return { start: formatDate(thisMonday), end: todayStr, label: '本週' };
    }

    case 'last-week': {
      const thisMonday = getMonday(today);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(lastMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(lastSunday.getDate() - 1);
      return { start: formatDate(lastMonday), end: formatDate(lastSunday), label: '上週' };
    }

    case 'this-month': {
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: formatDate(thisMonthStart), end: todayStr, label: '本月' };
    }

    case 'last-month': {
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: formatDate(lastMonthStart), end: formatDate(lastMonthEnd), label: '上月' };
    }

    case 'custom':
      if (customStart && customEnd) {
        return { start: customStart, end: customEnd, label: `${customStart} ~ ${customEnd}` };
      }
      return { start: todayStr, end: todayStr, label: '自訂' };

    default:
      return { start: todayStr, end: todayStr, label: '今日' };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ store: string; period: string }> }
) {
  try {
    const { store, period } = await params;
    const storeName = decodeURIComponent(store);
    const { searchParams } = new URL(req.url);
    const customStart = searchParams.get('start') || undefined;
    const customEnd = searchParams.get('end') || undefined;

    const { start, end, label } = getDateRange(period, customStart, customEnd);

    // 查詢該時段的銷售明細（按商品彙總）
    const result = await query<{
      product_id: string;
      product_name: string;
      total_qty: string;
      total_revenue: string;
      transaction_count: string;
    }>(
      `SELECT
        product_id,
        product_name,
        SUM(quantity) as total_qty,
        SUM(total) as total_revenue,
        COUNT(*) as transaction_count
      FROM member_transactions
      WHERE store = $1
        AND transaction_date >= $2
        AND transaction_date <= $3
        AND transaction_type = '收銀'
      GROUP BY product_id, product_name
      ORDER BY total_revenue DESC
      LIMIT 200`,
      [storeName, start, end]
    );

    // 計算總營收
    const totalRevenue = result.rows.reduce((sum, r) => sum + Number(r.total_revenue), 0);
    const totalQty = result.rows.reduce((sum, r) => sum + Number(r.total_qty), 0);

    return NextResponse.json({
      success: true,
      data: {
        store: storeName,
        period: period,
        label: label,
        date_range: { start, end },
        summary: {
          total_revenue: totalRevenue,
          total_qty: totalQty,
          product_count: result.rows.length,
        },
        products: result.rows.map(r => ({
          product_id: r.product_id,
          product_name: r.product_name,
          quantity: Number(r.total_qty),
          revenue: Number(r.total_revenue),
          transaction_count: Number(r.transaction_count),
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
