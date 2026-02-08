import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { fetchAllStoresData, STORE_ORGS } from '@/lib/spec-b2b-client';
import { pushMessage } from '@/lib/line';

export const maxDuration = 60; // Allow up to 60s for sync

export async function POST() {
  const startedAt = new Date();

  try {
    // Verify credentials are configured
    if (!process.env.SPEC_B2B_USERNAME || !process.env.SPEC_B2B_PASSWORD) {
      return NextResponse.json(
        { success: false, error: 'B2B credentials not configured (SPEC_B2B_USERNAME, SPEC_B2B_PASSWORD)' },
        { status: 503 }
      );
    }

    // Fetch data from Specialized B2B portal for all 4 stores
    const data = await fetchAllStoresData();

    let shipmentsUpserted = 0;
    let ordersUpserted = 0;
    const newShipmentIds: string[] = [];

    // Upsert shipments
    for (const s of data.shipments) {
      const shipmentId = String(s.shipmentId || s.shipmentNumber);
      if (!shipmentId) continue;

      // Check if this is a new shipment
      const existing = await query('SELECT 1 FROM spec_shipments WHERE shipment_id = $1', [shipmentId]);
      if (existing.rows.length === 0) {
        newShipmentIds.push(`${s.store}: ${shipmentId} (PO: ${s.custPONumber || '-'}, $${s.shippedTotal || 0})`);
      }

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
          shipmentId,
          s.custPONumber || null,
          (s.shipTo || '').trim() || null,
          s.orderType || null,
          s.dateShipped || null,
          s.shippedTotal ?? null,
          s.shippedQty ?? null,
          s.trackingUrl || null,
          s.currencyCode || 'TWD',
          JSON.stringify({
            store: s.store,
            orgId: s.orgId,
            shipmentNumber: s.shipmentNumber,
            custPONumber: s.custPONumber,
            shipTo: s.shipTo,
            orderType: s.orderType,
            dateShipped: s.dateShipped,
            shippedTotal: s.shippedTotal,
            shippedQty: s.shippedQty,
            trackingUrl: s.trackingUrl,
            currencyCode: s.currencyCode,
          }),
        ]
      );
      shipmentsUpserted++;
    }

    // Upsert orders
    for (const o of data.orders) {
      if (!o.orderId) continue;

      // Extract EBS ID and status from dynamic properties
      const ebsId = o.dynamicProperties?.find(d => d.id === 'sbc_ebsId')?.value as string;
      const country = o.dynamicProperties?.find(d => d.id === 'sbc_country')?.value as string;

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
          o.orderId,
          ebsId || null,
          null, // order_type from OCC doesn't map directly
          o.creationTime ? new Date(o.creationTime).toISOString().split('T')[0] : null,
          o.state || null,
          null, // total_amount not directly available in list view
          country === 'TW' ? 'TWD' : 'USD',
          JSON.stringify({
            store: o.store,
            orgId: o.orgId,
            orderId: o.orderId,
            state: o.state,
            creationTime: o.creationTime,
            ebsId,
            country,
          }),
        ]
      );
      ordersUpserted++;
    }

    const totalSynced = shipmentsUpserted + ordersUpserted;

    // Write sync log
    await query(
      `INSERT INTO sync_logs (sync_type, status, records_synced, started_at, completed_at)
       VALUES ('specialized-b2b-sync', 'success', $1, $2, NOW())`,
      [totalSynced, startedAt]
    );

    // Send LINE notification for new shipments
    if (newShipmentIds.length > 0) {
      const adminIds = (process.env.ADMIN_LINE_IDS || '').split(',').filter(Boolean);
      const msg = `Specialized 新出貨 (${newShipmentIds.length} 筆)\n${newShipmentIds.join('\n')}`;
      for (const lineId of adminIds) {
        await pushMessage(lineId.trim(), [{ type: 'text', text: msg }]).catch(() => {});
      }
      console.log(`[Spec Sync] Notified ${adminIds.length} admins about ${newShipmentIds.length} new shipments`);
    }

    const storeBreakdown: Record<string, { shipments: number; orders: number }> = {};
    for (const store of Object.keys(STORE_ORGS)) {
      storeBreakdown[store] = {
        shipments: data.shipments.filter(s => s.store === store).length,
        orders: data.orders.filter(o => o.store === store).length,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        shipments: shipmentsUpserted,
        orders: ordersUpserted,
        total: totalSynced,
        stores: storeBreakdown,
        duration_ms: Date.now() - startedAt.getTime(),
      },
    });
  } catch (error) {
    console.error('B2B sync error:', error);

    try {
      await query(
        `INSERT INTO sync_logs (sync_type, status, error_message, started_at, completed_at)
         VALUES ('specialized-b2b-sync', 'error', $1, $2, NOW())`,
        [error instanceof Error ? error.message : 'Unknown error', startedAt]
      );
    } catch { /* ignore logging error */ }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
