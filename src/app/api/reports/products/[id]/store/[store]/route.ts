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

    // Get product name from inventory or member_transactions
    const productResult = await query(`
      SELECT product_name FROM inventory WHERE product_id = $1 LIMIT 1
    `, [productId]);

    let productName = productResult.rows[0]?.product_name;

    // If not in inventory, try member_transactions
    if (!productName) {
      const txProductResult = await query(`
        SELECT product_name FROM member_transactions WHERE product_id = $1 LIMIT 1
      `, [productId]);
      productName = txProductResult.rows[0]?.product_name || productId;
    }

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

    // For each order, get other products in the SAME order (same store, same date, same order_number)
    const orders = [];

    for (const orderRow of ordersResult.rows) {
      // Get all products for this specific order at this store on this date
      const orderProductsResult = await query(`
        SELECT
          product_id,
          product_name,
          quantity,
          price,
          total
        FROM member_transactions
        WHERE order_number = $1
          AND store = $2
          AND transaction_date = $3
          AND transaction_type = '收銀'
        ORDER BY total DESC
      `, [orderRow.order_number, storeName, orderRow.transaction_date]);

      const allProducts = orderProductsResult.rows.map(p => ({
        product_id: p.product_id,
        product_name: p.product_name,
        quantity: Number(p.quantity),
        price: Number(p.price),
        total: Number(p.total),
      }));

      const orderTotal = allProducts.reduce((sum, p) => sum + p.total, 0);

      orders.push({
        order_number: orderRow.order_number,
        date: orderRow.transaction_date,
        member_name: orderRow.member_name || '(未知)',
        member_phone: orderRow.member_phone || '',
        this_product: {
          quantity: Number(orderRow.quantity),
          price: Number(orderRow.price),
          total: Number(orderRow.total),
        },
        all_products: allProducts,
        order_total: orderTotal,
      });
    }

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
