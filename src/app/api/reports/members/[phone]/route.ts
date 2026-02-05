import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const { phone } = await params;
    const memberPhone = decodeURIComponent(phone);

    // Get member info
    const memberResult = await query(`
      SELECT
        phone,
        name,
        member_level,
        total_spent,
        line_user_id IS NOT NULL as line_binding
      FROM unified_members
      WHERE phone = $1
      LIMIT 1
    `, [memberPhone]);

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: '找不到會員' }, { status: 404 });
    }

    const member = memberResult.rows[0];

    // Get transaction history
    const transactionsResult = await query(`
      SELECT
        TO_CHAR(transaction_date, 'YYYY-MM-DD') as transaction_date,
        store,
        product_id,
        product_name,
        quantity,
        total,
        transaction_type
      FROM member_transactions
      WHERE member_phone = $1
      ORDER BY transaction_date DESC, id DESC
      LIMIT 50
    `, [memberPhone]);

    return NextResponse.json({
      success: true,
      data: {
        phone: member.phone,
        name: member.name,
        member_level: member.member_level,
        total_spent: Number(member.total_spent),
        line_binding: member.line_binding,
        transactions: transactionsResult.rows.map(t => ({
          transaction_date: t.transaction_date,
          store: t.store,
          product_id: t.product_id,
          product_name: t.product_name,
          quantity: t.quantity,
          total: Number(t.total),
          transaction_type: t.transaction_type,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
