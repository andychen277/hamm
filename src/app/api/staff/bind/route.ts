import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateBindCode, sendTelegramMessage } from '@/lib/telegram';

// POST: 產生綁定驗證碼
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { staffId } = body;

    if (!staffId) {
      return NextResponse.json(
        { success: false, error: '員工 ID 為必填' },
        { status: 400 }
      );
    }

    // 產生驗證碼，有效期 10 分鐘
    const bindCode = generateBindCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await query(`
      UPDATE staff
      SET bind_code = $1, bind_code_expires = $2
      WHERE id = $3
    `, [bindCode, expires, staffId]);

    return NextResponse.json({
      success: true,
      data: {
        bindCode,
        expiresAt: expires,
        instructions: `請在 Telegram 傳送以下訊息給 @Forge277bot：\n/bind ${bindCode}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}

// PUT: 驗證並完成綁定（由 Telegram webhook 呼叫）
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { bindCode, chatId, username } = body;

    if (!bindCode || !chatId) {
      return NextResponse.json(
        { success: false, error: '驗證碼和 chat ID 為必填' },
        { status: 400 }
      );
    }

    // 查找有效的驗證碼
    const result = await query(`
      SELECT id, name FROM staff
      WHERE bind_code = $1
        AND bind_code_expires > NOW()
        AND is_active = true
    `, [bindCode.toUpperCase()]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '驗證碼無效或已過期' },
        { status: 400 }
      );
    }

    const staff = result.rows[0];

    // 更新 Telegram 綁定資訊
    await query(`
      UPDATE staff
      SET telegram_user_id = $1,
          telegram_username = $2,
          bind_code = NULL,
          bind_code_expires = NULL,
          updated_at = NOW()
      WHERE id = $3
    `, [chatId.toString(), username || null, staff.id]);

    // 發送綁定成功通知
    await sendTelegramMessage({
      chatId: chatId.toString(),
      text: `✅ <b>綁定成功！</b>\n\n歡迎 ${staff.name}！\n您已成功綁定 277 Bike 工作通知。\n\n之後有新任務指派給您時，會透過此頻道通知。`,
    });

    return NextResponse.json({
      success: true,
      data: {
        staffId: staff.id,
        staffName: staff.name,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
