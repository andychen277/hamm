import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; store: string }> }
) {
  try {
    const { id, store } = await params;
    const productId = decodeURIComponent(id);
    const storeName = decodeURIComponent(store);

    // Get product name
    const productResult = await query(`
      SELECT product_name FROM inventory WHERE product_id = $1 LIMIT 1
    `, [productId]);

    const productName = productResult.rows[0]?.product_name || productId;

    // Get all orders for this product at this store (last 90 days)
    const ordersResult = await query(`
      SELECT DISTINCT
        order_number,
        transaction_date,
        member_name,
        member_phone,
        quantity,
        price,
        total
      FROM member_transactions
      WHERE product_id = $1
        AND store = $2
        AND transaction_type = '收銀'
        AND transaction_date >= CURRENT_DATE - INTERVAL '90 days'
      ORDER BY transaction_date DESC, order_number DESC
    `, [productId, storeName]);

    // Get all products in each order
    const orderNumbers = ordersResult.rows.map(r => r.order_number).filter(Boolean);

    let orderProducts: Record<string, Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      price: number;
      total: number;
    }>> = {};

    if (orderNumbers.length > 0) {
      // Get all products for these orders
      const productsResult = await query(`
        SELECT
          order_number,
          product_id,
          product_name,
          quantity,
          price,
          total
        FROM member_transactions
        WHERE order_number = ANY($1)
          AND transaction_type = '收銀'
        ORDER BY order_number, total DESC
      `, [orderNumbers]);

      // Group products by order
      for (const row of productsResult.rows) {
        if (!orderProducts[row.order_number]) {
          orderProducts[row.order_number] = [];
        }
        orderProducts[row.order_number].push({
          product_id: row.product_id,
          product_name: row.product_name,
          quantity: Number(row.quantity),
          price: Number(row.price),
          total: Number(row.total),
        });
      }
    }

    // Build response with orders and their products
    const orders = ordersResult.rows.map(r => ({
      order_number: r.order_number,
      date: r.transaction_date,
      member_name: r.member_name || '(未知)',
      member_phone: r.member_phone || '',
      this_product: {
        quantity: Number(r.quantity),
        price: Number(r.price),
        total: Number(r.total),
      },
      all_products: orderProducts[r.order_number] || [],
      order_total: (orderProducts[r.order_number] || []).reduce((sum, p) => sum + p.total, 0),
    }));

    // Calculate totals
    const totalRevenue = orders.reduce((sum, o) => sum + o.this_product.total, 0);
    const totalQty = orders.reduce((sum, o) => sum + o.this_product.quantity, 0);

    return NextResponse.json({
      success: true,
      data: {
        product_id: productId,
        product_name: productName,
        store: storeName,
        summary: {
          total_revenue: totalRevenue,
          total_qty: totalQty,
          order_count: orders.length,
        },
        orders,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
