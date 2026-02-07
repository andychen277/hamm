import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const repairId = decodeURIComponent(id);
    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ success: false, error: '缺少 status 欄位' }, { status: 400 });
    }

    const result = await query(
      `UPDATE repairs SET status = $1, updated_at = NOW() WHERE repair_id = $2 RETURNING repair_id, status`,
      [status, repairId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: '找不到維修單' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Repair update error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const repairId = decodeURIComponent(id);

    // Get repair details
    const repairResult = await query(`
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
        TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI') as updated_at,
        TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at
      FROM repairs
      WHERE repair_id = $1
    `, [repairId]);

    if (repairResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Repair not found' },
        { status: 404 }
      );
    }

    const repair = repairResult.rows[0];

    // Get customer's other repairs (if phone exists)
    let customerRepairs: Array<{
      repair_id: string;
      store: string;
      open_date: string;
      status: string;
      repair_desc: string;
    }> = [];

    if (repair.customer_phone) {
      const customerResult = await query(`
        SELECT
          repair_id,
          store,
          TO_CHAR(open_date, 'YYYY-MM-DD') as open_date,
          status,
          repair_desc
        FROM repairs
        WHERE customer_phone = $1
          AND repair_id != $2
        ORDER BY open_date DESC
        LIMIT 10
      `, [repair.customer_phone, repairId]);

      customerRepairs = customerResult.rows.map(r => ({
        repair_id: r.repair_id,
        store: r.store,
        open_date: r.open_date,
        status: r.status,
        repair_desc: r.repair_desc || '',
      }));
    }

    // Get customer's transaction history (if phone exists)
    let customerTransactions: Array<{
      date: string;
      store: string;
      product_name: string;
      quantity: number;
      total: number;
    }> = [];

    if (repair.customer_phone) {
      const txResult = await query(`
        SELECT
          transaction_date,
          store,
          product_name,
          quantity,
          total
        FROM member_transactions
        WHERE member_phone = $1
          AND transaction_type = '收銀'
        ORDER BY transaction_date DESC
        LIMIT 10
      `, [repair.customer_phone]);

      customerTransactions = txResult.rows.map(r => ({
        date: r.transaction_date,
        store: r.store,
        product_name: r.product_name,
        quantity: Number(r.quantity),
        total: Number(r.total),
      }));
    }

    // Check if customer has LINE binding
    let hasLineBinding = false;
    if (repair.customer_phone) {
      const bindingResult = await query(
        `SELECT 1 FROM line_bindings
         WHERE phone = $1 AND bind_status = 'verified'
         LIMIT 1`,
        [repair.customer_phone]
      );
      if (bindingResult.rows.length === 0) {
        const memberResult = await query(
          `SELECT 1 FROM unified_members
           WHERE phone = $1 AND line_user_id IS NOT NULL
           LIMIT 1`,
          [repair.customer_phone]
        );
        hasLineBinding = memberResult.rows.length > 0;
      } else {
        hasLineBinding = true;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        repair_id: repair.repair_id,
        store: repair.store,
        open_date: repair.open_date,
        customer_name: repair.customer_name || '',
        customer_phone: repair.customer_phone || '',
        repair_desc: repair.repair_desc || '',
        deposit: Number(repair.deposit) || 0,
        store_note: repair.store_note || '',
        vendor_quote: Number(repair.vendor_quote) || 0,
        vendor_note: repair.vendor_note || '',
        assigned_to: repair.assigned_to || '',
        status: repair.status || '',
        updated_at: repair.updated_at,
        created_at: repair.created_at,
        customer_repairs: customerRepairs,
        customer_transactions: customerTransactions,
        has_line_binding: hasLineBinding,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
