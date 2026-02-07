import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // API key auth
    const apiKey = process.env.SPEC_SYNC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Sync API not configured' },
        { status: 503 }
      );
    }

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (token !== apiKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { shipments, orders, pending_orders } = body;
    const startedAt = new Date();
    let totalSynced = 0;
    const summary: Record<string, number> = {};

    // Upsert shipments
    if (Array.isArray(shipments) && shipments.length > 0) {
      let count = 0;
      for (const s of shipments) {
        if (!s.shipment_id) continue;
        await query(
          `INSERT INTO spec_shipments
            (shipment_id, cust_po_number, ship_to, order_type, date_shipped,
             shipped_total, shipped_qty, tracking_url, currency_code, raw_data, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
           ON CONFLICT (shipment_id) DO UPDATE SET
             cust_po_number = COALESCE(EXCLUDED.cust_po_number, spec_shipments.cust_po_number),
             ship_to = COALESCE(EXCLUDED.ship_to, spec_shipments.ship_to),
             order_type = COALESCE(EXCLUDED.order_type, spec_shipments.order_type),
             date_shipped = COALESCE(EXCLUDED.date_shipped, spec_shipments.date_shipped),
             shipped_total = COALESCE(EXCLUDED.shipped_total, spec_shipments.shipped_total),
             shipped_qty = COALESCE(EXCLUDED.shipped_qty, spec_shipments.shipped_qty),
             tracking_url = COALESCE(EXCLUDED.tracking_url, spec_shipments.tracking_url),
             currency_code = COALESCE(EXCLUDED.currency_code, spec_shipments.currency_code),
             raw_data = COALESCE(EXCLUDED.raw_data, spec_shipments.raw_data),
             updated_at = NOW()`,
          [
            s.shipment_id,
            s.cust_po_number || null,
            s.ship_to || null,
            s.order_type || null,
            s.date_shipped || null,
            s.shipped_total ?? null,
            s.shipped_qty ?? null,
            s.tracking_url || null,
            s.currency_code || 'TWD',
            s.raw_data ? JSON.stringify(s.raw_data) : null,
          ]
        );
        count++;
      }
      summary.shipments = count;
      totalSynced += count;
    }

    // Upsert orders
    if (Array.isArray(orders) && orders.length > 0) {
      let count = 0;
      for (const o of orders) {
        if (!o.order_id) continue;
        await query(
          `INSERT INTO spec_orders
            (order_id, order_number, order_type, order_date, order_status,
             total_amount, currency_code, raw_data, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
           ON CONFLICT (order_id) DO UPDATE SET
             order_number = COALESCE(EXCLUDED.order_number, spec_orders.order_number),
             order_type = COALESCE(EXCLUDED.order_type, spec_orders.order_type),
             order_date = COALESCE(EXCLUDED.order_date, spec_orders.order_date),
             order_status = COALESCE(EXCLUDED.order_status, spec_orders.order_status),
             total_amount = COALESCE(EXCLUDED.total_amount, spec_orders.total_amount),
             currency_code = COALESCE(EXCLUDED.currency_code, spec_orders.currency_code),
             raw_data = COALESCE(EXCLUDED.raw_data, spec_orders.raw_data),
             updated_at = NOW()`,
          [
            o.order_id,
            o.order_number || null,
            o.order_type || null,
            o.order_date || null,
            o.order_status || null,
            o.total_amount ?? null,
            o.currency_code || 'TWD',
            o.raw_data ? JSON.stringify(o.raw_data) : null,
          ]
        );
        count++;
      }
      summary.orders = count;
      totalSynced += count;
    }

    // Upsert pending orders
    if (Array.isArray(pending_orders) && pending_orders.length > 0) {
      let count = 0;
      for (const p of pending_orders) {
        if (!p.order_id) continue;
        await query(
          `INSERT INTO spec_pending_orders
            (order_id, order_number, order_type, order_status,
             total_amount, submitted_date, currency_code, raw_data, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
           ON CONFLICT (order_id) DO UPDATE SET
             order_number = COALESCE(EXCLUDED.order_number, spec_pending_orders.order_number),
             order_type = COALESCE(EXCLUDED.order_type, spec_pending_orders.order_type),
             order_status = COALESCE(EXCLUDED.order_status, spec_pending_orders.order_status),
             total_amount = COALESCE(EXCLUDED.total_amount, spec_pending_orders.total_amount),
             submitted_date = COALESCE(EXCLUDED.submitted_date, spec_pending_orders.submitted_date),
             currency_code = COALESCE(EXCLUDED.currency_code, spec_pending_orders.currency_code),
             raw_data = COALESCE(EXCLUDED.raw_data, spec_pending_orders.raw_data),
             updated_at = NOW()`,
          [
            p.order_id,
            p.order_number || null,
            p.order_type || null,
            p.order_status || null,
            p.total_amount ?? null,
            p.submitted_date || null,
            p.currency_code || 'TWD',
            p.raw_data ? JSON.stringify(p.raw_data) : null,
          ]
        );
        count++;
      }
      summary.pending_orders = count;
      totalSynced += count;
    }

    // Write sync log
    await query(
      `INSERT INTO sync_logs (sync_type, status, records_synced, started_at, completed_at)
       VALUES ('specialized-sync', 'success', $1, $2, NOW())`,
      [totalSynced, startedAt]
    );

    return NextResponse.json({
      success: true,
      data: { ...summary, total: totalSynced },
    });
  } catch (error) {
    console.error('Specialized sync error:', error);

    // Log error
    try {
      await query(
        `INSERT INTO sync_logs (sync_type, status, error_message, started_at, completed_at)
         VALUES ('specialized-sync', 'error', $1, NOW(), NOW())`,
        [error instanceof Error ? error.message : 'Unknown error']
      );
    } catch { /* ignore logging error */ }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
