import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = decodeURIComponent(id);

    // Get order details
    const orderResult = await query(
      `SELECT
        order_id,
        store,
        TO_CHAR(order_date, 'YYYY-MM-DD') as order_date,
        employee_code,
        customer_name,
        customer_phone,
        product_info,
        total_amount,
        deposit_paid,
        balance,
        status,
        TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI') as updated_at,
        TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at
      FROM customer_orders
      WHERE order_id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '找不到客訂單' },
        { status: 404 }
      );
    }

    const order = orderResult.rows[0];

    // Get customer's other orders
    let customerOrders: Record<string, unknown>[] = [];
    if (order.customer_phone) {
      const ordersResult = await query(
        `SELECT
          order_id,
          store,
          TO_CHAR(order_date, 'YYYY-MM-DD') as order_date,
          status,
          product_info,
          total_amount
        FROM customer_orders
        WHERE customer_phone = $1 AND order_id != $2
        ORDER BY order_date DESC
        LIMIT 5`,
        [order.customer_phone, orderId]
      );
      customerOrders = ordersResult.rows;
    }

    // Get customer's recent transactions
    let customerTransactions: Record<string, unknown>[] = [];
    if (order.customer_phone) {
      const txResult = await query(
        `SELECT
          TO_CHAR(transaction_date, 'YYYY-MM-DD') as date,
          store,
          product_name,
          quantity,
          total
        FROM member_transactions
        WHERE member_phone = $1 AND transaction_type = '收銀'
        ORDER BY transaction_date DESC
        LIMIT 10`,
        [order.customer_phone]
      );
      customerTransactions = txResult.rows;
    }

    // Check if customer has LINE binding
    let hasLineBinding = false;
    if (order.customer_phone) {
      const bindingResult = await query(
        `SELECT 1 FROM line_bindings
         WHERE phone = $1 AND bind_status = 'verified'
         LIMIT 1`,
        [order.customer_phone]
      );
      if (bindingResult.rows.length === 0) {
        const memberResult = await query(
          `SELECT 1 FROM unified_members
           WHERE phone = $1 AND line_user_id IS NOT NULL
           LIMIT 1`,
          [order.customer_phone]
        );
        hasLineBinding = memberResult.rows.length > 0;
      } else {
        hasLineBinding = true;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        order_id: order.order_id,
        store: order.store,
        order_date: order.order_date,
        employee_code: order.employee_code,
        customer_name: order.customer_name || '',
        customer_phone: order.customer_phone || '',
        product_info: order.product_info || '',
        total_amount: Number(order.total_amount),
        deposit_paid: Number(order.deposit_paid),
        balance: Number(order.balance),
        status: order.status || '',
        updated_at: order.updated_at,
        created_at: order.created_at,
        has_line_binding: hasLineBinding,
        customer_orders: customerOrders.map((o: Record<string, unknown>) => ({
          order_id: o.order_id,
          store: o.store,
          order_date: o.order_date,
          status: o.status,
          product_info: o.product_info,
          total_amount: Number(o.total_amount),
        })),
        customer_transactions: customerTransactions.map((t: Record<string, unknown>) => ({
          date: t.date,
          store: t.store,
          product_name: t.product_name,
          quantity: Number(t.quantity),
          total: Number(t.total),
        })),
      },
    });
  } catch (error) {
    console.error('Order detail error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
