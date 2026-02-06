import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ supplier: string }> }
) {
  try {
    const { supplier } = await params;
    const supplierName = decodeURIComponent(supplier);
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('product_id') || '';

    // Get recent purchases from this supplier (last 90 days)
    const purchasesResult = await query(`
      SELECT
        ps.product_id,
        ps.product_name,
        ps.supplier,
        ps.unit_cost,
        ps.total_qty,
        ps.total_cost,
        ps.stock_tainan,
        ps.stock_kaohsiung,
        ps.stock_taichung,
        ps.stock_taipei,
        ps.stock_meishu,
        TO_CHAR(ps.period_start, 'YYYY-MM-DD') as period_start,
        TO_CHAR(ps.period_end, 'YYYY-MM-DD') as period_end
      FROM purchase_summary ps
      WHERE ps.supplier ILIKE $1
        AND ps.period_start >= CURRENT_DATE - INTERVAL '90 days'
      ORDER BY ps.period_start DESC, ps.product_name
      LIMIT 100
    `, [`%${supplierName}%`]);

    // Get current inventory for all products from this supplier
    const inventoryResult = await query(`
      SELECT
        i.product_id,
        i.product_name,
        i.store,
        i.quantity,
        i.price,
        i.cost
      FROM inventory i
      WHERE i.vendor_name ILIKE $1
        ${productId ? 'AND i.product_id = $2' : ''}
      ORDER BY i.product_name, i.store
    `, productId ? [`%${supplierName}%`, productId] : [`%${supplierName}%`]);

    // Group inventory by store
    const inventoryByStore: Record<string, { store: string; total_qty: number; total_value: number; products: number }> = {};
    const inventoryByProduct: Record<string, { product_id: string; product_name: string; stores: { store: string; quantity: number; price: number }[] }> = {};

    for (const row of inventoryResult.rows) {
      // By store
      if (!inventoryByStore[row.store]) {
        inventoryByStore[row.store] = { store: row.store, total_qty: 0, total_value: 0, products: 0 };
      }
      inventoryByStore[row.store].total_qty += Number(row.quantity);
      inventoryByStore[row.store].total_value += Number(row.quantity) * Number(row.price);
      inventoryByStore[row.store].products += 1;

      // By product
      if (!inventoryByProduct[row.product_id]) {
        inventoryByProduct[row.product_id] = {
          product_id: row.product_id,
          product_name: row.product_name,
          stores: [],
        };
      }
      inventoryByProduct[row.product_id].stores.push({
        store: row.store,
        quantity: Number(row.quantity),
        price: Number(row.price),
      });
    }

    // Calculate totals
    const totalPurchaseCost = purchasesResult.rows.reduce((sum, r) => sum + Number(r.total_cost), 0);
    const totalPurchaseQty = purchasesResult.rows.reduce((sum, r) => sum + Number(r.total_qty), 0);

    return NextResponse.json({
      success: true,
      data: {
        supplier: supplierName,
        purchases: purchasesResult.rows.map(r => ({
          product_id: r.product_id,
          product_name: r.product_name,
          supplier: r.supplier,
          unit_cost: Number(r.unit_cost),
          total_qty: Number(r.total_qty),
          total_cost: Number(r.total_cost),
          stock_tainan: Number(r.stock_tainan),
          stock_kaohsiung: Number(r.stock_kaohsiung),
          stock_taichung: Number(r.stock_taichung),
          stock_taipei: Number(r.stock_taipei),
          stock_meishu: Number(r.stock_meishu),
          period_start: r.period_start,
          period_end: r.period_end,
        })),
        inventory_by_store: Object.values(inventoryByStore).sort((a, b) => b.total_qty - a.total_qty),
        inventory_by_product: Object.values(inventoryByProduct),
        totals: {
          purchase_cost: totalPurchaseCost,
          purchase_qty: totalPurchaseQty,
          inventory_qty: Object.values(inventoryByStore).reduce((sum, s) => sum + s.total_qty, 0),
        },
      },
    });
  } catch (error) {
    console.error('Supplier purchases error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
