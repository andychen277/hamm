import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barcode = searchParams.get('barcode')?.trim();

    if (!barcode) {
      return NextResponse.json(
        { success: false, error: '請提供條碼' },
        { status: 400 }
      );
    }

    // 1. Exact match on product_id
    let result = await query(
      `SELECT DISTINCT product_id, product_name, price
       FROM inventory
       WHERE product_id = $1
       LIMIT 1`,
      [barcode]
    );

    // 2. If no exact match, try ILIKE
    if (result.rows.length === 0) {
      result = await query(
        `SELECT DISTINCT product_id, product_name, price
         FROM inventory
         WHERE product_id ILIKE $1
         LIMIT 1`,
        [`%${barcode}%`]
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: '找不到商品',
        barcode,
      });
    }

    const product = result.rows[0];

    // Get stock by store
    const stockResult = await query(
      `SELECT store, SUM(quantity)::int AS quantity
       FROM inventory
       WHERE product_id = $1
       GROUP BY store
       ORDER BY store`,
      [product.product_id]
    );

    return NextResponse.json({
      success: true,
      data: {
        product_id: product.product_id,
        product_name: product.product_name,
        price: Number(product.price) || 0,
        stores: stockResult.rows.map(r => ({
          store: r.store,
          quantity: Number(r.quantity),
        })),
      },
    });
  } catch (error) {
    console.error('Receiving lookup error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
