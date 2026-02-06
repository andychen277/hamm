import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(_req: NextRequest) {
  try {
    // Get overall stats
    const statsResult = await query(`
      SELECT
        COUNT(*) as total_members,
        COUNT(line_user_id) FILTER (WHERE line_user_id IS NOT NULL AND line_user_id != '') as bound_count
      FROM unified_members
    `);

    const stats = statsResult.rows[0];
    const totalMembers = Number(stats.total_members);
    const boundCount = Number(stats.bound_count);
    const unboundCount = totalMembers - boundCount;
    const bindingRate = totalMembers > 0 ? (boundCount / totalMembers) * 100 : 0;

    // Get top unbound members (highest spenders without LINE binding)
    const unboundResult = await query(`
      SELECT
        phone,
        name,
        member_level,
        total_spent
      FROM unified_members
      WHERE line_user_id IS NULL OR line_user_id = ''
      ORDER BY total_spent DESC
      LIMIT 20
    `);

    // Get recently bound members
    const boundResult = await query(`
      SELECT
        u.phone,
        u.name,
        u.member_level,
        u.total_spent,
        lb.bound_at
      FROM unified_members u
      LEFT JOIN line_bindings lb ON u.phone = lb.phone
      WHERE u.line_user_id IS NOT NULL AND u.line_user_id != ''
      ORDER BY lb.bound_at DESC NULLS LAST
      LIMIT 20
    `);

    return NextResponse.json({
      success: true,
      data: {
        total_members: totalMembers,
        bound_count: boundCount,
        unbound_count: unboundCount,
        binding_rate: bindingRate,
        top_unbound: unboundResult.rows.map(m => ({
          phone: m.phone,
          name: m.name,
          member_level: m.member_level,
          total_spent: Number(m.total_spent),
          bound_at: null,
        })),
        recent_bound: boundResult.rows.map(m => ({
          phone: m.phone,
          name: m.name,
          member_level: m.member_level,
          total_spent: Number(m.total_spent),
          bound_at: m.bound_at,
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
