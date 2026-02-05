import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const store = searchParams.get('store');

    let sql = `
      SELECT
        store,
        product_id,
        product_name,
        price,
        quantity,
        vendor_code,
        TO_CHAR(updated_at, 'MM/DD HH24:MI') as updated_at
      FROM inventory
      WHERE quantity > 0
    `;

    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (q) {
      // 支援逗號分隔的多關鍵字搜尋
      const keywords = q.split(',').map(k => k.trim()).filter(k => k.length > 0);

      for (const keyword of keywords) {
        // 每個關鍵字同時搜尋 product_name 和 product_id
        sql += ` AND (product_name ILIKE $${paramIndex} OR product_id ILIKE $${paramIndex})`;
        params.push(`%${keyword}%`);
        paramIndex++;
      }
    }

    if (store && store !== 'all') {
      sql += ` AND store = $${paramIndex}`;
      params.push(store);
      paramIndex++;
    }

    sql += `
      ORDER BY product_name, store
      LIMIT 200
    `;

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      data: result.rows.map(r => ({
        store: r.store,
        product_id: r.product_id,
        product_name: r.product_name,
        price: Number(r.price),
        quantity: Number(r.quantity),
        vendor_code: r.vendor_code || '',
        updated_at: r.updated_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
