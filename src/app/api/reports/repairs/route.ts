import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = searchParams.get('end') || new Date().toISOString().split('T')[0];
    const q = searchParams.get('q') || '';
    const store = searchParams.get('store');
    const status = searchParams.get('status');

    let sql = `
      SELECT
        repair_id,
        store,
        TO_CHAR(open_date, 'YYYY-MM-DD') as open_date,
        customer_name,
        customer_phone,
        repair_desc,
        deposit,
        store_note,
        vendor_quote,
        vendor_note,
        assigned_to,
        status,
        TO_CHAR(updated_at, 'MM/DD HH24:MI') as updated_at
      FROM repairs
      WHERE open_date >= $1
        AND open_date <= $2
    `;

    const params: (string | number)[] = [start, end];
    let paramIndex = 3;

    if (q) {
      sql += ` AND (customer_name ILIKE $${paramIndex} OR customer_phone LIKE $${paramIndex})`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    if (store && store !== 'all') {
      sql += ` AND store = $${paramIndex}`;
      params.push(store);
      paramIndex++;
    }

    if (status && status !== 'all') {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += `
      ORDER BY open_date DESC, repair_id DESC
      LIMIT 100
    `;

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      data: result.rows.map(r => ({
        repair_id: r.repair_id,
        store: r.store,
        open_date: r.open_date,
        customer_name: r.customer_name || '',
        customer_phone: r.customer_phone || '',
        repair_desc: r.repair_desc || '',
        deposit: Number(r.deposit) || 0,
        store_note: r.store_note || '',
        vendor_quote: Number(r.vendor_quote) || 0,
        vendor_note: r.vendor_note || '',
        assigned_to: r.assigned_to || '',
        status: r.status || '',
        updated_at: r.updated_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
