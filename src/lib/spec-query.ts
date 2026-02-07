import { query } from './db';

// Types for Specialized data
export interface SpecShipment {
  id: number;
  shipment_id: string;
  cust_po_number: string;
  ship_to: string;
  order_type: string;
  date_shipped: string;
  shipped_total: number;
  shipped_qty: number;
  tracking_url: string;
  currency_code: string;
  raw_data: Record<string, unknown>;
  created_at: string;
}

export interface SpecOrder {
  id: number;
  order_id: string;
  order_number: string;
  order_type: string;
  order_date: string;
  order_status: string;
  total_amount: number;
  currency_code: string;
  raw_data: Record<string, unknown>;
  created_at: string;
}

export interface SpecPendingOrder {
  id: number;
  order_id: string;
  order_number: string;
  order_type: string;
  order_status: string;
  total_amount: number;
  submitted_date: string;
  currency_code: string;
  raw_data: Record<string, unknown>;
  created_at: string;
}

/**
 * Get recent Specialized shipments
 */
export async function getRecentShipments(days = 30) {
  const result = await query(
    `SELECT id, shipment_id, cust_po_number, ship_to, order_type,
            TO_CHAR(date_shipped, 'YYYY-MM-DD') as date_shipped,
            shipped_total, shipped_qty, tracking_url, currency_code,
            TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at
     FROM spec_shipments
     WHERE date_shipped >= CURRENT_DATE - $1::integer
     ORDER BY date_shipped DESC`,
    [days]
  );
  return result.rows;
}

/**
 * Get Specialized shipments that haven't been received yet
 * (no matching receiving_orders with supplier containing 'Specialized' and note referencing shipment_id)
 */
export async function getPendingReceiveShipments() {
  const result = await query(
    `SELECT s.id, s.shipment_id, s.cust_po_number, s.ship_to, s.order_type,
            TO_CHAR(s.date_shipped, 'YYYY-MM-DD') as date_shipped,
            s.shipped_total, s.shipped_qty, s.tracking_url,
            TO_CHAR(s.created_at, 'YYYY-MM-DD HH24:MI') as created_at
     FROM spec_shipments s
     WHERE s.date_shipped >= CURRENT_DATE - 30
       AND NOT EXISTS (
         SELECT 1 FROM receiving_orders r
         WHERE r.supplier ILIKE '%specialized%'
           AND r.note ILIKE '%' || s.shipment_id || '%'
       )
     ORDER BY s.date_shipped DESC
     LIMIT 20`
  );
  return result.rows;
}

/**
 * Get Specialized order history
 */
export async function getOrderHistory(days = 90) {
  const result = await query(
    `SELECT id, order_id, order_number, order_type,
            TO_CHAR(order_date, 'YYYY-MM-DD') as order_date,
            order_status, total_amount, currency_code,
            TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at
     FROM spec_orders
     WHERE order_date >= CURRENT_DATE - $1::integer
     ORDER BY order_date DESC`,
    [days]
  );
  return result.rows;
}

/**
 * Get Specialized pending orders (in-transit / not yet shipped)
 */
export async function getPendingOrders() {
  const result = await query(
    `SELECT id, order_id, order_number, order_type, order_status,
            total_amount, currency_code,
            TO_CHAR(submitted_date, 'YYYY-MM-DD') as submitted_date,
            TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at
     FROM spec_pending_orders
     ORDER BY submitted_date DESC`
  );
  return result.rows;
}

/**
 * Get inventory + in-transit summary for Specialized products
 * Returns current stock + pending shipments + pending orders
 */
export async function getInventoryWithTransit() {
  // Current inventory for all stores
  const inventoryResult = await query(
    `SELECT product_id, product_name, store, price, quantity
     FROM inventory
     WHERE vendor_code ILIKE '%specialized%' OR product_name ILIKE '%specialized%'
     ORDER BY product_name, store`
  );

  // In-transit (shipped but not received)
  const inTransitResult = await query(
    `SELECT s.id, s.shipment_id, s.cust_po_number, s.ship_to,
            TO_CHAR(s.date_shipped, 'YYYY-MM-DD') as date_shipped,
            s.shipped_total, s.shipped_qty
     FROM spec_shipments s
     WHERE s.date_shipped >= CURRENT_DATE - 30
       AND NOT EXISTS (
         SELECT 1 FROM receiving_orders r
         WHERE r.supplier ILIKE '%specialized%'
           AND r.note ILIKE '%' || s.shipment_id || '%'
       )
     ORDER BY s.date_shipped DESC`
  );

  // Pending orders (not yet shipped)
  const pendingResult = await query(
    `SELECT id, order_id, order_number, order_status, total_amount,
            TO_CHAR(submitted_date, 'YYYY-MM-DD') as submitted_date
     FROM spec_pending_orders
     WHERE order_status NOT IN ('Cancelled', 'Shipped')
     ORDER BY submitted_date DESC`
  );

  return {
    inventory: inventoryResult.rows,
    inTransit: inTransitResult.rows,
    pendingOrders: pendingResult.rows,
  };
}

/**
 * Get sync status - last successful Specialized sync
 */
export async function getLastSyncStatus() {
  const result = await query(
    `SELECT sync_type, status,
            TO_CHAR(completed_at, 'YYYY-MM-DD HH24:MI') as completed_at,
            records_synced
     FROM sync_logs
     WHERE sync_type ILIKE '%specialized%'
     ORDER BY completed_at DESC
     LIMIT 1`
  );
  return result.rows[0] || null;
}
