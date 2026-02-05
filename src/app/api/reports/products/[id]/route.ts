import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = decodeURIComponent(id);

    // Get inventory info (stock by store)
    const inventoryResult = await query(`
      SELECT store, product_name, price, quantity, vendor_code, updated_at
      FROM inventory
      WHERE product_id = $1
      ORDER BY store
    `, [productId]);

    // Get sales summary (last 90 days)
    const salesResult = await query(`
      SELECT
        store,
        SUM(quantity) as total_qty,
        SUM(total) as total_revenue,
        COUNT(DISTINCT order_number) as order_count,
        MAX(transaction_date) as last_sale_date
      FROM member_transactions
      WHERE product_id = $1
        AND transaction_type = '收銀'
        AND transaction_date >= CURRENT_DATE - INTERVAL '90 days'
      GROUP BY store
      ORDER BY total_revenue DESC
    `, [productId]);

    // Get total sales stats
    const totalSalesResult = await query(`
      SELECT
        SUM(quantity) as total_qty,
        SUM(total) as total_revenue,
        COUNT(DISTINCT order_number) as order_count,
        MIN(transaction_date) as first_sale_date,
        MAX(transaction_date) as last_sale_date
      FROM member_transactions
      WHERE product_id = $1
        AND transaction_type = '收銀'
    `, [productId]);

    // Get recent transactions (last 20)
    const recentTxResult = await query(`
      SELECT
        transaction_date,
        store,
        quantity,
        price,
        total,
        order_number,
        member_name
      FROM member_transactions
      WHERE product_id = $1
        AND transaction_type = '收銀'
      ORDER BY transaction_date DESC, id DESC
      LIMIT 20
    `, [productId]);

    // Get purchase info
    const purchaseResult = await query(`
      SELECT
        supplier,
        unit_cost,
        total_qty as purchase_qty,
        total_cost as purchase_cost,
        period_start,
        period_end
      FROM purchase_summary
      WHERE product_id = $1
      ORDER BY period_end DESC
      LIMIT 5
    `, [productId]);

    const productName = inventoryResult.rows[0]?.product_name ||
                        recentTxResult.rows[0]?.product_name ||
                        productId;

    return NextResponse.json({
      success: true,
      data: {
        product_id: productId,
        product_name: productName,
        inventory: inventoryResult.rows.map(r => ({
          store: r.store,
          price: Number(r.price),
          quantity: Number(r.quantity),
          vendor_code: r.vendor_code,
          updated_at: r.updated_at,
        })),
        sales_by_store: salesResult.rows.map(r => ({
          store: r.store,
          total_qty: Number(r.total_qty),
          total_revenue: Number(r.total_revenue),
          order_count: Number(r.order_count),
          last_sale_date: r.last_sale_date,
        })),
        total_sales: totalSalesResult.rows[0] ? {
          total_qty: Number(totalSalesResult.rows[0].total_qty) || 0,
          total_revenue: Number(totalSalesResult.rows[0].total_revenue) || 0,
          order_count: Number(totalSalesResult.rows[0].order_count) || 0,
          first_sale_date: totalSalesResult.rows[0].first_sale_date,
          last_sale_date: totalSalesResult.rows[0].last_sale_date,
        } : null,
        recent_transactions: recentTxResult.rows.map(r => ({
          date: r.transaction_date,
          store: r.store,
          quantity: Number(r.quantity),
          price: Number(r.price),
          total: Number(r.total),
          order_number: r.order_number,
          member_name: r.member_name,
        })),
        purchases: purchaseResult.rows.map(r => ({
          supplier: r.supplier,
          unit_cost: Number(r.unit_cost),
          purchase_qty: Number(r.purchase_qty),
          purchase_cost: Number(r.purchase_cost),
          period_start: r.period_start,
          period_end: r.period_end,
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
