import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

const STORE_CODES: Record<string, string> = {
  '台南': '001', '崇明': '008', '高雄': '002',
  '美術': '007', '台中': '005', '台北': '006',
};

function generateOrderNo(fromCode: string, toCode: string): string {
  const now = new Date();
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const ts = tw.getFullYear().toString() +
    String(tw.getMonth() + 1).padStart(2, '0') +
    String(tw.getDate()).padStart(2, '0') +
    String(tw.getHours()).padStart(2, '0') +
    String(tw.getMinutes()).padStart(2, '0') +
    String(tw.getSeconds()).padStart(2, '0');
  return `TRF${fromCode}${toCode}${ts}`;
}

// POST: 建立調貨單
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const { from_store, to_store, logistics, tracking_no, note, items } = body;

    if (!from_store || !to_store) {
      return NextResponse.json(
        { success: false, error: '請選擇來源門市和目的門市' },
        { status: 400 }
      );
    }

    if (from_store === to_store) {
      return NextResponse.json(
        { success: false, error: '來源門市和目的門市不能相同' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: '請至少掃描一個商品' },
        { status: 400 }
      );
    }

    const fromCode = STORE_CODES[from_store] || '001';
    const toCode = STORE_CODES[to_store] || '002';
    const orderNo = generateOrderNo(fromCode, toCode);
    const totalItems = items.length;
    const totalQty = items.reduce((sum: number, item: { quantity: number }) => sum + (item.quantity || 1), 0);

    const orderResult = await query(
      `INSERT INTO transfer_orders (order_no, staff_id, staff_name, from_store, to_store, logistics, tracking_no, total_items, total_qty, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, order_no`,
      [
        orderNo,
        session?.staff_id || null,
        session?.name || body.staff_name || 'Unknown',
        from_store,
        to_store,
        logistics || null,
        tracking_no || null,
        totalItems,
        totalQty,
        note || null,
      ]
    );

    const orderId = orderResult.rows[0].id;

    for (const item of items) {
      await query(
        `INSERT INTO transfer_items (transfer_order_id, product_id, product_name, barcode, price, quantity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orderId,
          item.product_id || null,
          item.product_name || '',
          item.barcode || item.product_id || '',
          item.price || 0,
          item.quantity || 1,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: orderId,
        order_no: orderNo,
        total_items: totalItems,
        total_qty: totalQty,
      },
    });
  } catch (error) {
    console.error('Create transfer order error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create transfer order' },
      { status: 500 }
    );
  }
}

// GET: 列出調貨單
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const store = searchParams.get('store') || '';
    const days = parseInt(searchParams.get('days') || '30', 10);

    let sql = `
      SELECT id, order_no, staff_name, from_store, to_store, logistics, tracking_no,
             total_items, total_qty, status, note, created_at
      FROM transfer_orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
    `;
    const params: string[] = [];

    if (store && store !== 'all') {
      params.push(store);
      sql += ` AND (from_store = $${params.length} OR to_store = $${params.length})`;
    }

    sql += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      data: result.rows.map(r => ({
        id: r.id,
        order_no: r.order_no,
        staff_name: r.staff_name,
        from_store: r.from_store,
        to_store: r.to_store,
        logistics: r.logistics || '',
        tracking_no: r.tracking_no || '',
        total_items: Number(r.total_items),
        total_qty: Number(r.total_qty),
        status: r.status,
        note: r.note || '',
        created_at: r.created_at,
      })),
    });
  } catch (error) {
    console.error('List transfer orders error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
