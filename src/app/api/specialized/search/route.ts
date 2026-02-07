import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'shipments';
    const dateFrom = searchParams.get('date_from') || '';
    const dateTo = searchParams.get('date_to') || '';

    const params: (string | number)[] = [];
    let sql = '';

    if (type === 'shipments') {
      sql = `SELECT id, shipment_id, cust_po_number, ship_to, order_type,
              TO_CHAR(date_shipped, 'YYYY-MM-DD') as date_shipped,
              shipped_total, shipped_qty, tracking_url, currency_code,
              TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at
       FROM spec_shipments WHERE 1=1`;

      if (q) {
        params.push(`%${q}%`);
        const idx = params.length;
        sql += ` AND (shipment_id ILIKE $${idx} OR cust_po_number ILIKE $${idx} OR ship_to ILIKE $${idx})`;
      }
      if (dateFrom) {
        params.push(dateFrom);
        sql += ` AND date_shipped >= $${params.length}`;
      }
      if (dateTo) {
        params.push(dateTo);
        sql += ` AND date_shipped <= $${params.length}`;
      }
      sql += ` ORDER BY date_shipped DESC LIMIT 50`;

    } else if (type === 'orders') {
      sql = `SELECT id, order_id, order_number, order_type,
              TO_CHAR(order_date, 'YYYY-MM-DD') as order_date,
              order_status, total_amount, currency_code,
              TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at
       FROM spec_orders WHERE 1=1`;

      if (q) {
        params.push(`%${q}%`);
        const idx = params.length;
        sql += ` AND (order_id ILIKE $${idx} OR order_number ILIKE $${idx} OR order_status ILIKE $${idx})`;
      }
      if (dateFrom) {
        params.push(dateFrom);
        sql += ` AND order_date >= $${params.length}`;
      }
      if (dateTo) {
        params.push(dateTo);
        sql += ` AND order_date <= $${params.length}`;
      }
      sql += ` ORDER BY order_date DESC LIMIT 50`;

    } else if (type === 'pending') {
      sql = `SELECT id, order_id, order_number, order_type, order_status,
              total_amount, currency_code,
              TO_CHAR(submitted_date, 'YYYY-MM-DD') as submitted_date,
              TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at
       FROM spec_pending_orders WHERE 1=1`;

      if (q) {
        params.push(`%${q}%`);
        const idx = params.length;
        sql += ` AND (order_id ILIKE $${idx} OR order_number ILIKE $${idx} OR order_status ILIKE $${idx})`;
      }
      if (dateFrom) {
        params.push(dateFrom);
        sql += ` AND submitted_date >= $${params.length}`;
      }
      if (dateTo) {
        params.push(dateTo);
        sql += ` AND submitted_date <= $${params.length}`;
      }
      sql += ` ORDER BY submitted_date DESC LIMIT 50`;
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Use: shipments, orders, pending' },
        { status: 400 }
      );
    }

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      type,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Specialized search error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
