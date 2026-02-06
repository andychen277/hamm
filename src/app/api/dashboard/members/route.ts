import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(_req: NextRequest) {
  try {
    // Get total count
    const totalResult = await query('SELECT COUNT(*) as total FROM unified_members');
    const total = Number(totalResult.rows[0].total);

    // Get count by level
    const levelResult = await query(`
      SELECT
        member_level as level,
        COUNT(*) as count,
        COALESCE(SUM(total_spent), 0) as total_spent
      FROM unified_members
      GROUP BY member_level
      ORDER BY
        CASE member_level
          WHEN 'vip' THEN 1
          WHEN 'gold' THEN 2
          WHEN 'silver' THEN 3
          ELSE 4
        END
    `);

    // Get count by home store (from first transaction)
    const storeResult = await query(`
      SELECT
        store,
        COUNT(*) as count
      FROM (
        SELECT
          member_phone,
          store,
          ROW_NUMBER() OVER (PARTITION BY member_phone ORDER BY transaction_date ASC) as rn
        FROM member_transactions
        WHERE member_phone IS NOT NULL AND member_phone != ''
      ) sub
      WHERE rn = 1
      GROUP BY store
      ORDER BY count DESC
    `);

    // Get top VIP members
    const vipResult = await query(`
      SELECT
        phone,
        name,
        member_level,
        total_spent
      FROM unified_members
      WHERE member_level = 'vip'
      ORDER BY total_spent DESC
      LIMIT 10
    `);

    return NextResponse.json({
      success: true,
      data: {
        total,
        by_level: levelResult.rows.map(r => ({
          level: r.level,
          count: Number(r.count),
          total_spent: Number(r.total_spent),
        })),
        by_store: storeResult.rows.map(r => ({
          store: r.store,
          count: Number(r.count),
        })),
        recent_vip: vipResult.rows.map(r => ({
          phone: r.phone,
          name: r.name,
          member_level: r.member_level,
          total_spent: Number(r.total_spent),
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
