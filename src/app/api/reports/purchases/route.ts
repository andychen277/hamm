import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = searchParams.get('end') || new Date().toISOString().split('T')[0];
    const q = searchParams.get('q') || '';
    const store = searchParams.get('store');

    // Map store names to column names
    const storeColumnMap: Record<string, string> = {
      '台南': 'stock_tainan',
      '高雄': 'stock_kaohsiung',
      '台中': 'stock_taichung',
      '台北': 'stock_taipei',
      '美術': 'stock_meishu',
    };

    let sql = `
      SELECT
        product_id,
        product_name,
        supplier,
        unit_price,
        unit_cost,
        total_cost,
        total_qty,
        stock_tainan,
        stock_chongming,
        stock_kaohsiung,
        stock_meishu,
        stock_taichung,
        stock_taipei,
        total_sales,
        total_sales_qty,
        sales_ratio,
        TO_CHAR(period_start, 'YYYY-MM-DD') as period_start,
        TO_CHAR(period_end, 'YYYY-MM-DD') as period_end
      FROM purchase_summary
      WHERE period_start >= $1
        AND period_end <= $2
    `;

    const params: (string | number)[] = [start, end];
    let paramIndex = 3;

    if (q) {
      sql += ` AND (product_name ILIKE $${paramIndex} OR supplier ILIKE $${paramIndex})`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    // Filter by store (show only products with stock in that store)
    if (store && storeColumnMap[store]) {
      sql += ` AND ${storeColumnMap[store]} > 0`;
    }

    sql += `
      ORDER BY total_cost DESC
      LIMIT 100
    `;

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      data: result.rows.map(r => ({
        product_id: r.product_id,
        product_name: r.product_name,
        supplier: r.supplier || '',
        unit_price: Number(r.unit_price),
        unit_cost: Number(r.unit_cost),
        total_cost: Number(r.total_cost),
        total_qty: Number(r.total_qty),
        stock_tainan: Number(r.stock_tainan),
        stock_chongming: Number(r.stock_chongming),
        stock_kaohsiung: Number(r.stock_kaohsiung),
        stock_meishu: Number(r.stock_meishu),
        stock_taichung: Number(r.stock_taichung),
        stock_taipei: Number(r.stock_taipei),
        total_sales: Number(r.total_sales),
        total_sales_qty: Number(r.total_sales_qty),
        sales_ratio: Number(r.sales_ratio),
        period_start: r.period_start,
        period_end: r.period_end,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
