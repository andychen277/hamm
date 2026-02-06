import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET: 取得員工列表
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const store = searchParams.get('store');
    const activeOnly = searchParams.get('active') !== 'false';

    let sql = `
      SELECT id, name, store, role,
             telegram_user_id,
             telegram_user_id AS telegram_chat_id,
             telegram_user_id IS NOT NULL as telegram_bound,
             telegram_username,
             is_active, created_at
      FROM staff
      WHERE 1=1
    `;
    const params: string[] = [];

    if (activeOnly) {
      sql += ` AND is_active = true`;
    }

    if (store) {
      params.push(store);
      sql += ` AND store = $${params.length}`;
    }

    sql += ` ORDER BY store, name`;

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}

// POST: 新增員工
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, store, role, telegram_user_id, telegram_username } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: '姓名為必填' },
        { status: 400 }
      );
    }

    const result = await query(`
      INSERT INTO staff (name, store, role, telegram_user_id, telegram_username)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, store, role, telegram_user_id, telegram_username
    `, [name, store || null, role || 'staff', telegram_user_id || null, telegram_username || null]);

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Insert failed' },
      { status: 500 }
    );
  }
}
