import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const [repairs, orders, todoPending] = await Promise.all([
      // Active repairs
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM repair_status_log
         WHERE last_known_status NOT IN ('completed', '已完修', '已取車')`
      ),
      // Pending customer orders
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM order_status_log
         WHERE last_known_status IN ('pending', '已訂未到', '未到貨')`
      ),
      // Pending todos
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM todos WHERE status = 'pending'`
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        active_repairs: Number(repairs.rows[0].count),
        pending_orders: Number(orders.rows[0].count),
        todo_pending: Number(todoPending.rows[0].count),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
