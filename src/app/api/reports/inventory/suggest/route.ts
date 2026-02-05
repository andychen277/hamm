import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';

    if (!q || q.length < 2) {
      return NextResponse.json({
        success: true,
        suggestions: [],
      });
    }

    // 支援逗號分隔的多關鍵字
    const keywords = q.split(',').map(k => k.trim()).filter(k => k.length > 0);

    if (keywords.length === 0) {
      return NextResponse.json({
        success: true,
        suggestions: [],
      });
    }

    // 建立 SQL 查詢 - 每個關鍵字都要符合（AND 邏輯）
    let sql = `
      SELECT DISTINCT product_id, product_name
      FROM inventory
      WHERE quantity > 0
    `;

    const params: string[] = [];
    keywords.forEach((keyword, index) => {
      const paramIndex = index + 1;
      sql += ` AND (product_name ILIKE $${paramIndex} OR product_id ILIKE $${paramIndex})`;
      params.push(`%${keyword}%`);
    });

    sql += `
      ORDER BY product_name
      LIMIT 10
    `;

    const result = await query<{ product_id: string; product_name: string }>(sql, params);

    return NextResponse.json({
      success: true,
      suggestions: result.rows.map(r => ({
        product_id: r.product_id,
        product_name: r.product_name,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
