import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const vendor = searchParams.get('vendor') || '';
    const store = searchParams.get('store') || '';
    const yearsBack = parseInt(searchParams.get('years') || '3', 10);
    const monthsBack = parseInt(searchParams.get('months') || '12', 10);

    if (!q && !vendor) {
      return NextResponse.json({
        success: false,
        error: '請輸入商品名稱或廠商代碼',
      }, { status: 400 });
    }

    // Strategy: Search both inventory AND member_transactions for product matches
    // This allows finding products that are sold out but have historical sales

    let productIds: string[] = [];
    let products: { product_id: string; product_name: string; vendor_code: string; vendor_name: string; price: number; cost: number }[] = [];

    // 1. First try inventory (has vendor info)
    if (q) {
      const inventoryQuery = `
        SELECT DISTINCT product_id, product_name, vendor_code, price
        FROM inventory
        WHERE product_name ILIKE $1 OR product_id ILIKE $1 OR vendor_code ILIKE $1
        ${vendor ? `AND vendor_code ILIKE $2` : ''}
        ORDER BY product_name
        LIMIT 100
      `;
      const inventoryParams = vendor ? [`%${q}%`, `%${vendor}%`] : [`%${q}%`];
      const inventoryResult = await query(inventoryQuery, inventoryParams);

      products = inventoryResult.rows.map(p => ({
        product_id: p.product_id,
        product_name: p.product_name,
        vendor_code: p.vendor_code || '',
        vendor_name: '',
        price: Number(p.price) || 0,
        cost: 0,
      }));
      productIds = products.map(p => p.product_id);
    }

    // 2. If no inventory matches, search member_transactions directly
    if (productIds.length === 0 && q) {
      const txProductQuery = `
        SELECT DISTINCT product_id, product_name
        FROM member_transactions
        WHERE (product_name ILIKE $1 OR product_id ILIKE $1)
          AND transaction_type = '收銀'
        ORDER BY product_name
        LIMIT 100
      `;
      const txProductResult = await query(txProductQuery, [`%${q}%`]);

      products = txProductResult.rows.map(p => ({
        product_id: p.product_id,
        product_name: p.product_name,
        vendor_code: '',
        vendor_name: '',
        price: 0,
        cost: 0,
      }));
      productIds = products.map(p => p.product_id);
    }

    // 3. If vendor-only search
    if (productIds.length === 0 && vendor && !q) {
      const vendorQuery = `
        SELECT DISTINCT product_id, product_name, vendor_code, price
        FROM inventory
        WHERE vendor_code ILIKE $1
        ORDER BY product_name
        LIMIT 100
      `;
      const vendorResult = await query(vendorQuery, [`%${vendor}%`]);

      products = vendorResult.rows.map(p => ({
        product_id: p.product_id,
        product_name: p.product_name,
        vendor_code: p.vendor_code || '',
        vendor_name: '',
        price: Number(p.price) || 0,
        cost: 0,
      }));
      productIds = products.map(p => p.product_id);
    }

    if (productIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          products: [],
          yearly_summary: [],
          monthly_detail: [],
          current_inventory: [],
          inventory_totals: { qty: 0, cost: 0, value: 0 },
        },
      });
    }

    // Build store condition for transactions
    let storeCondition = '';
    const txParams: (string | string[] | number)[] = [productIds];
    let txParamIndex = 2;

    if (store && store !== 'all') {
      storeCondition = `AND store = $${txParamIndex}`;
      txParams.push(store);
      txParamIndex++;
    }

    // Get yearly sales summary
    const yearlySalesQuery = `
      SELECT
        EXTRACT(YEAR FROM transaction_date)::int AS year,
        COUNT(DISTINCT order_number) AS order_count,
        SUM(quantity)::int AS total_qty,
        SUM(total)::numeric AS total_revenue
      FROM member_transactions
      WHERE product_id = ANY($1)
        AND transaction_type = '收銀'
        AND transaction_date >= CURRENT_DATE - INTERVAL '${yearsBack} years'
        ${storeCondition}
      GROUP BY EXTRACT(YEAR FROM transaction_date)
      ORDER BY year DESC
    `;

    const yearlySalesResult = await query(yearlySalesQuery, txParams);

    // Get monthly sales detail (for the specified months back)
    const monthlySalesQuery = `
      SELECT
        TO_CHAR(transaction_date, 'YYYY-MM') AS month,
        EXTRACT(YEAR FROM transaction_date)::int AS year,
        EXTRACT(MONTH FROM transaction_date)::int AS month_num,
        COUNT(DISTINCT order_number) AS order_count,
        SUM(quantity)::int AS total_qty,
        SUM(total)::numeric AS total_revenue
      FROM member_transactions
      WHERE product_id = ANY($1)
        AND transaction_type = '收銀'
        AND transaction_date >= CURRENT_DATE - INTERVAL '${monthsBack} months'
        ${storeCondition}
      GROUP BY TO_CHAR(transaction_date, 'YYYY-MM'),
               EXTRACT(YEAR FROM transaction_date),
               EXTRACT(MONTH FROM transaction_date)
      ORDER BY month DESC
    `;

    const monthlySalesResult = await query(monthlySalesQuery, txParams);

    // Get current inventory by store
    const inventoryQuery = `
      SELECT
        store,
        SUM(quantity)::int AS total_qty,
        SUM(quantity * price)::numeric AS total_value
      FROM inventory
      WHERE product_id = ANY($1)
        ${store && store !== 'all' ? `AND store = $2` : ''}
      GROUP BY store
      ORDER BY store
    `;

    const inventoryParams: (string | string[])[] = [productIds];
    if (store && store !== 'all') {
      inventoryParams.push(store);
    }

    const inventoryResult = await query(inventoryQuery, inventoryParams);

    // Get purchase summary by year (from purchase_summary table)
    const purchaseQuery = `
      SELECT
        EXTRACT(YEAR FROM period_start)::int AS year,
        SUM(total_qty)::int AS total_qty,
        SUM(total_cost)::numeric AS total_cost
      FROM purchase_summary
      WHERE product_id = ANY($1)
        AND period_start >= CURRENT_DATE - INTERVAL '${yearsBack} years'
      GROUP BY EXTRACT(YEAR FROM period_start)
      ORDER BY year DESC
    `;

    const purchaseResult = await query(purchaseQuery, [productIds]);

    // Merge yearly sales with purchase data
    const purchaseByYear = new Map(purchaseResult.rows.map(p => [p.year, p]));

    const yearlySummary = yearlySalesResult.rows.map(row => {
      const purchase = purchaseByYear.get(row.year);
      return {
        year: row.year,
        order_count: Number(row.order_count),
        total_qty: Number(row.total_qty),
        total_revenue: Number(row.total_revenue),
        purchase_qty: purchase ? Number(purchase.total_qty) : 0,
        purchase_cost: purchase ? Number(purchase.total_cost) : 0,
      };
    });

    // Calculate totals
    const totalInventoryQty = inventoryResult.rows.reduce((sum, r) => sum + Number(r.total_qty), 0);
    const totalInventoryValue = inventoryResult.rows.reduce((sum, r) => sum + Number(r.total_value), 0);

    return NextResponse.json({
      success: true,
      data: {
        products,
        yearly_summary: yearlySummary,
        monthly_detail: monthlySalesResult.rows.map(row => ({
          month: row.month,
          year: row.year,
          month_num: row.month_num,
          order_count: Number(row.order_count),
          total_qty: Number(row.total_qty),
          total_revenue: Number(row.total_revenue),
        })),
        current_inventory: inventoryResult.rows.map(row => ({
          store: row.store,
          qty: Number(row.total_qty),
          cost: 0,
          value: Number(row.total_value),
        })),
        inventory_totals: {
          qty: totalInventoryQty,
          cost: 0,
          value: totalInventoryValue,
        },
      },
    });
  } catch (error) {
    console.error('History report error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
