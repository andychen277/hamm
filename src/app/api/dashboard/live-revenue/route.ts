import { NextRequest, NextResponse } from 'next/server';
import { getLiveRevenue } from '@/lib/erp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const result = await getLiveRevenue(forceRefresh);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'ERP 查詢失敗' },
        { status: 500 }
      );
    }

    // 計算總營收
    const totalRevenue = result.data?.reduce((sum, s) => sum + s.revenue, 0) || 0;
    const totalProducts = result.data?.reduce((sum, s) => sum + s.productCount, 0) || 0;

    return NextResponse.json({
      success: true,
      data: {
        date: result.date,
        total_revenue: totalRevenue,
        total_products: totalProducts,
        stores: result.data?.sort((a, b) => b.revenue - a.revenue) || [],
        cached_at: result.cachedAt,
      },
    });
  } catch (error) {
    console.error('Live revenue API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '查詢失敗' },
      { status: 500 }
    );
  }
}
