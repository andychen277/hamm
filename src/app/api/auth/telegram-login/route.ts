import { NextRequest, NextResponse } from 'next/server';
import { signToken, TOKEN_NAME, TOKEN_MAX_AGE } from '@/lib/auth';
import { query } from '@/lib/db';

interface StaffRow {
  id: number;
  name: string;
  store: string | null;
  role: string;
  telegram_username: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const { telegram_user_id } = await req.json();

    if (!telegram_user_id) {
      return NextResponse.json(
        { success: false, error: '請輸入 Telegram User ID' },
        { status: 400 }
      );
    }

    // 查詢 staff 表
    const result = await query<StaffRow>(
      `SELECT id, name, store, role, telegram_username
       FROM staff
       WHERE telegram_user_id = $1 AND is_active = true`,
      [telegram_user_id.toString()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '未授權的帳號，請聯繫管理員' },
        { status: 401 }
      );
    }

    const staff = result.rows[0];

    // 建立 JWT token
    const token = signToken({
      sub: `staff_${staff.id}`,
      staff_id: staff.id,
      name: staff.name,
      role: staff.role as 'admin' | 'owner' | 'manager' | 'staff',
      store: staff.store,
      store_access: staff.store ? [staff.store] : ['all'],
    });

    const response = NextResponse.json({
      success: true,
      data: {
        name: staff.name,
        store: staff.store,
        role: staff.role,
      },
    });

    response.cookies.set(TOKEN_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: TOKEN_MAX_AGE,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Telegram login error:', error);
    return NextResponse.json(
      { success: false, error: '登入失敗' },
      { status: 500 }
    );
  }
}
