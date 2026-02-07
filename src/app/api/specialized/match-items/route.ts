import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticate, fetchOrderDetail, STORE_ORGS } from '@/lib/spec-b2b-client';

interface MatchedItem {
  // From B2B order
  productId: string;
  catRefId: string;
  displayName: string;
  quantity: number;
  unitPrice: number;
  rawTotalPrice: number;
  // Match result from 277 inventory
  matched: boolean;
  inv_product_id?: string;
  inv_product_name?: string;
  inv_price?: number;
  inv_stores?: Array<{ store: string; quantity: number }>;
}

/**
 * GET /api/specialized/match-items?shipment_id=xxx
 * Fetches order line items from B2B API and matches against 277 inventory
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shipmentId = searchParams.get('shipment_id');

    if (!shipmentId) {
      return NextResponse.json(
        { success: false, error: '請提供 shipment_id' },
        { status: 400 }
      );
    }

    // Get shipment info (including raw_data with orgId and PO number)
    const shipmentResult = await query(
      `SELECT shipment_id, cust_po_number, ship_to, shipped_total, shipped_qty, raw_data
       FROM spec_shipments WHERE shipment_id = $1`,
      [shipmentId]
    );

    if (shipmentResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '找不到此出貨單' },
        { status: 404 }
      );
    }

    const shipment = shipmentResult.rows[0];
    const rawData = shipment.raw_data || {};
    const orgId = rawData.orgId;
    const storeName = rawData.store;

    if (!orgId) {
      // Fallback: try to determine orgId from store name
      const fallbackOrgId = storeName ? STORE_ORGS[storeName] : null;
      if (!fallbackOrgId) {
        return NextResponse.json({
          success: true,
          data: {
            shipment_id: shipmentId,
            po_number: shipment.cust_po_number,
            items: [],
            source: 'no_org_id',
            message: '無法取得組織 ID，無法查詢訂單明細',
          },
        });
      }
    }

    const effectiveOrgId = orgId || (storeName ? STORE_ORGS[storeName] : null);

    // Find the order ID by PO number from spec_orders
    let orderId: string | null = null;

    // Try matching via spec_orders table first (PO number → order)
    if (shipment.cust_po_number) {
      const orderResult = await query(
        `SELECT order_id FROM spec_orders
         WHERE order_number = $1 OR raw_data->>'orderNumber' = $1
         LIMIT 1`,
        [shipment.cust_po_number]
      );
      if (orderResult.rows.length > 0) {
        orderId = orderResult.rows[0].order_id;
      }
    }

    // If no order found in DB, try fetching from B2B API using PO number as order ID
    if (!orderId && shipment.cust_po_number) {
      orderId = shipment.cust_po_number;
    }

    if (!orderId || !effectiveOrgId) {
      return NextResponse.json({
        success: true,
        data: {
          shipment_id: shipmentId,
          po_number: shipment.cust_po_number,
          items: [],
          source: 'no_order_id',
          message: '無法找到對應訂單',
        },
      });
    }

    // Fetch order detail from B2B API
    const token = await authenticate();
    const orderDetail = await fetchOrderDetail(token, orderId, effectiveOrgId);

    if (!orderDetail || orderDetail.commerceItems.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          shipment_id: shipmentId,
          po_number: shipment.cust_po_number,
          order_id: orderId,
          items: [],
          source: 'no_items',
          message: '訂單無明細資料',
        },
      });
    }

    // Match each item against 277 inventory
    const matchedItems: MatchedItem[] = [];

    for (const ci of orderDetail.commerceItems) {
      const item: MatchedItem = {
        productId: ci.productId,
        catRefId: ci.catRefId,
        displayName: ci.displayName,
        quantity: ci.quantity,
        unitPrice: ci.unitPrice,
        rawTotalPrice: ci.rawTotalPrice,
        matched: false,
      };

      // Strategy 1: Exact match on product_id
      let invResult = await query(
        `SELECT DISTINCT product_id, product_name, price
         FROM inventory WHERE product_id = $1 LIMIT 1`,
        [ci.catRefId || ci.productId]
      );

      // Strategy 2: Try ILIKE on product_id
      if (invResult.rows.length === 0 && ci.catRefId) {
        invResult = await query(
          `SELECT DISTINCT product_id, product_name, price
           FROM inventory WHERE product_id ILIKE $1 LIMIT 1`,
          [`%${ci.catRefId}%`]
        );
      }

      // Strategy 3: Fuzzy match on product name (extract key terms)
      if (invResult.rows.length === 0 && ci.displayName) {
        // Extract meaningful terms (skip common words)
        const terms = ci.displayName
          .replace(/[,()\/\-]/g, ' ')
          .split(/\s+/)
          .filter(t => t.length > 2)
          .slice(0, 3);

        if (terms.length > 0) {
          const conditions = terms.map((_, i) => `product_name ILIKE $${i + 1}`).join(' AND ');
          const params = terms.map(t => `%${t}%`);
          invResult = await query(
            `SELECT DISTINCT product_id, product_name, price
             FROM inventory WHERE ${conditions} LIMIT 3`,
            params
          );
        }
      }

      if (invResult.rows.length > 0) {
        const match = invResult.rows[0];
        item.matched = true;
        item.inv_product_id = match.product_id;
        item.inv_product_name = match.product_name;
        item.inv_price = Number(match.price) || 0;

        // Get stock by store
        const stockResult = await query(
          `SELECT store, SUM(quantity)::int AS quantity
           FROM inventory WHERE product_id = $1
           GROUP BY store ORDER BY store`,
          [match.product_id]
        );
        item.inv_stores = stockResult.rows.map(r => ({
          store: r.store,
          quantity: Number(r.quantity),
        }));
      }

      matchedItems.push(item);
    }

    const matchCount = matchedItems.filter(i => i.matched).length;

    return NextResponse.json({
      success: true,
      data: {
        shipment_id: shipmentId,
        po_number: shipment.cust_po_number,
        order_id: orderId,
        items: matchedItems,
        match_count: matchCount,
        total_count: matchedItems.length,
        source: 'b2b_api',
      },
    });
  } catch (error) {
    console.error('Match items error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to match items' },
      { status: 500 }
    );
  }
}
