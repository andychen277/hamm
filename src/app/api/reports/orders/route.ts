import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const store = searchParams.get('store');
    const status = searchParams.get('status');
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    let sql = `
      SELECT
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
        TO_CHAR(updated_at, 'MM/DD HH24:MI') as updated_at
      FROM customer_orders
      WHERE 1=1
    `;

    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (q) {
      sql += ` AND (customer_name ILIKE $${paramIndex} OR customer_phone ILIKE $${paramIndex} OR product_info ILIKE $${paramIndex})`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    if (store && store !== 'all') {
      sql += ` AND store = $${paramIndex}`;
      params.push(store);
      paramIndex++;
    }

    if (status && status !== 'all') {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (start) {
      sql += ` AND order_date >= $${paramIndex}`;
      params.push(start);
      paramIndex++;
    }

    if (end) {
      sql += ` AND order_date <= $${paramIndex}`;
      params.push(end);
      paramIndex++;
    }

    sql += `
      ORDER BY order_date DESC, order_id DESC
      LIMIT 200
    `;

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      data: result.rows.map(r => ({
        order_id: r.order_id,
        store: r.store,
        order_date: r.order_date,
        employee_code: r.employee_code,
        customer_name: r.customer_name || '',
        customer_phone: r.customer_phone || '',
        product_info: r.product_info || '',
        total_amount: Number(r.total_amount),
        deposit_paid: Number(r.deposit_paid),
        balance: Number(r.balance),
        status: r.status || '',
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
