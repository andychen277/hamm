import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createExpectedArrival } from '@/lib/erp';

const STORE_CODES: Record<string, string> = {
  '台南': '001', '崇明': '008', '高雄': '002',
  '美術': '007', '台中': '005', '台北': '006',
};

function generateOrderNo(storeCode: string): string {
  const now = new Date();
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const ts = tw.getFullYear().toString() +
    String(tw.getMonth() + 1).padStart(2, '0') +
    String(tw.getDate()).padStart(2, '0') +
    String(tw.getHours()).padStart(2, '0') +
    String(tw.getMinutes()).padStart(2, '0') +
    String(tw.getSeconds()).padStart(2, '0');
  return `RCV${storeCode}${ts}`;
}

interface ReceiveItem {
  product_id: string;
  product_name: string;
  barcode: string;
  price: number;
  quantity: number;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const { shipment_id, store, items } = body;

    if (!shipment_id || !store) {
      return NextResponse.json(
        { success: false, error: '請提供 shipment_id 和收貨門市' },
        { status: 400 }
      );
    }

    if (!STORE_CODES[store]) {
      return NextResponse.json(
        { success: false, error: '無效的門市' },
        { status: 400 }
      );
    }

    // Look up shipment
    const shipmentResult = await query(
      `SELECT shipment_id, cust_po_number, ship_to, shipped_total, shipped_qty
       FROM spec_shipments WHERE shipment_id = $1`,
      [shipment_id]
    );

    if (shipmentResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '找不到此出貨單' },
        { status: 404 }
      );
    }

    // Check if already received
    const existCheck = await query(
      `SELECT id FROM receiving_orders
       WHERE supplier ILIKE '%specialized%'
         AND note ILIKE '%' || $1 || '%'`,
      [shipment_id]
    );

    if (existCheck.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: '此出貨單已收貨' },
        { status: 409 }
      );
    }

    const shipment = shipmentResult.rows[0];
    const storeCode = STORE_CODES[store];
    const orderNo = generateOrderNo(storeCode);
    const note = `Spec Shipment: ${shipment.shipment_id} / PO: ${shipment.cust_po_number || '-'}`;

    // Determine items to insert
    const receiveItems: ReceiveItem[] = (items && Array.isArray(items) && items.length > 0)
      ? items
      : [{
          product_id: shipment.cust_po_number || shipment.shipment_id,
          product_name: `Specialized ${shipment.ship_to || ''} (PO: ${shipment.cust_po_number || shipment.shipment_id})`,
          barcode: shipment.shipment_id,
          price: shipment.shipped_total || 0,
          quantity: shipment.shipped_qty || 1,
        }];

    const totalItems = receiveItems.length;
    const totalQty = receiveItems.reduce((sum, i) => sum + (i.quantity || 1), 0);

    // Insert receiving order
    const orderResult = await query(
      `INSERT INTO receiving_orders (order_no, staff_id, staff_name, store, supplier, total_items, total_qty, note)
       VALUES ($1, $2, $3, $4, 'Specialized', $5, $6, $7)
       RETURNING id, order_no`,
      [
        orderNo,
        session?.staff_id || null,
        session?.name || 'Specialized Auto-Receive',
        store,
        totalItems,
        totalQty,
        note,
      ]
    );

    const orderId = orderResult.rows[0].id;

    // Insert each item
    for (const item of receiveItems) {
      await query(
        `INSERT INTO receiving_items (receiving_order_id, product_id, product_name, barcode, price, quantity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orderId,
          item.product_id,
          item.product_name,
          item.barcode || item.product_id,
          item.price || 0,
          item.quantity || 1,
        ]
      );
    }

    // Write to ERP: 預計到貨建檔
    let erpResult: { success: boolean; orderNumber: string; error?: string } | null = null;
    try {
      const today = new Date();
      const tw = new Date(today.getTime() + 8 * 60 * 60 * 1000);
      const arrivalDate = `${tw.getFullYear()}/${String(tw.getMonth() + 1).padStart(2, '0')}/${String(tw.getDate()).padStart(2, '0')}`;

      const itemLines = receiveItems.map(i =>
        `${i.product_name} x${i.quantity} $${i.price || 0}`
      ).join('\n');
      const memo = `PO: ${shipment.cust_po_number || shipment.shipment_id}\n${itemLines}`;

      erpResult = await createExpectedArrival({
        store,
        creator: session?.name || 'Hamm',
        supplierName: 'Specialized',
        arrivalDate,
        memo,
      }, storeCode);

      console.log(`[Specialized] ERP write result:`, erpResult);
    } catch (erpErr) {
      console.error('[Specialized] ERP write failed (non-blocking):', erpErr);
      erpResult = { success: false, orderNumber: '', error: String(erpErr) };
    }

    return NextResponse.json({
      success: true,
      data: {
        receiving_order_id: orderId,
        order_no: orderNo,
        total_items: totalItems,
        total_qty: totalQty,
        erp: erpResult,
      },
    });
  } catch (error) {
    console.error('Specialized receive error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to confirm receipt' },
      { status: 500 }
    );
  }
}
