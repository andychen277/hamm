import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const orderResult = await query(
      `SELECT id, order_no, staff_name, from_store, to_store, logistics, tracking_no,
              total_items, total_qty, status, note, created_at
       FROM transfer_orders WHERE id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '找不到調貨單' },
        { status: 404 }
      );
    }

    const itemsResult = await query(
      `SELECT id, product_id, product_name, barcode, price, quantity
       FROM transfer_items WHERE transfer_order_id = $1
       ORDER BY id`,
      [id]
    );

    const order = orderResult.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        order_no: order.order_no,
        staff_name: order.staff_name,
        from_store: order.from_store,
        to_store: order.to_store,
        logistics: order.logistics || '',
        tracking_no: order.tracking_no || '',
        total_items: Number(order.total_items),
        total_qty: Number(order.total_qty),
        status: order.status,
        note: order.note || '',
        created_at: order.created_at,
        items: itemsResult.rows.map(r => ({
          id: r.id,
          product_id: r.product_id,
          product_name: r.product_name,
          barcode: r.barcode,
          price: Number(r.price),
          quantity: Number(r.quantity),
        })),
      },
    });
  } catch (error) {
    console.error('Get transfer order error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
