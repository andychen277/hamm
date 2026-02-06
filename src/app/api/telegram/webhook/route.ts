import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      username?: string;
      first_name?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
  };
}

// POST: 接收 Telegram webhook
export async function POST(req: NextRequest) {
  try {
    const update: TelegramUpdate = await req.json();

    // 只處理私人訊息
    if (!update.message || update.message.chat.type !== 'private') {
      return NextResponse.json({ ok: true });
    }

    const chatId = update.message.chat.id.toString();
    const text = update.message.text || '';
    const username = update.message.from.username;
    const firstName = update.message.from.first_name;

    // 處理 /bind 指令
    if (text.startsWith('/bind ')) {
      const bindCode = text.replace('/bind ', '').trim().toUpperCase();

      if (!bindCode) {
        await sendTelegramMessage({
          chatId,
          text: '❌ 請提供驗證碼\n\n使用方式：/bind XXXXXX',
        });
        return NextResponse.json({ ok: true });
      }

      // 查找有效的驗證碼
      const result = await query(`
        SELECT id, name FROM staff
        WHERE bind_code = $1
          AND bind_code_expires > NOW()
          AND is_active = true
      `, [bindCode]);

      if (result.rows.length === 0) {
        await sendTelegramMessage({
          chatId,
          text: '❌ 驗證碼無效或已過期\n\n請重新在 Hamm 產生驗證碼。',
        });
        return NextResponse.json({ ok: true });
      }

      const staff = result.rows[0];

      // 更新綁定資訊
      await query(`
        UPDATE staff
        SET telegram_user_id = $1,
            telegram_username = $2,
            bind_code = NULL,
            bind_code_expires = NULL,
            updated_at = NOW()
        WHERE id = $3
      `, [chatId, username || null, staff.id]);

      await sendTelegramMessage({
        chatId,
        text: `✅ <b>綁定成功！</b>\n\n歡迎 ${staff.name}！\n您已成功綁定 277 Bike 工作通知。\n\n之後有新任務指派給您時，會透過此頻道通知。`,
      });

      return NextResponse.json({ ok: true });
    }

    // 處理 /start 指令
    if (text === '/start') {
      await sendTelegramMessage({
        chatId,
        text: `👋 歡迎使用 277 Bike 工作通知 Bot！\n\n${firstName ? `您好 ${firstName}！` : ''}\n\n<b>綁定步驟：</b>\n1. 登入 Hamm 系統\n2. 前往「設定」頁面\n3. 點擊「綁定 Telegram」\n4. 複製驗證碼\n5. 在這裡輸入：/bind 驗證碼\n\n如有問題請聯繫管理員。`,
      });
      return NextResponse.json({ ok: true });
    }

    // 處理 /status 指令
    if (text === '/status') {
      const result = await query(`
        SELECT name, store, role FROM staff
        WHERE telegram_user_id = $1 AND is_active = true
      `, [chatId]);

      if (result.rows.length === 0) {
        await sendTelegramMessage({
          chatId,
          text: '⚠️ 您尚未綁定帳號\n\n請使用 /start 查看綁定說明。',
        });
      } else {
        const staff = result.rows[0];
        await sendTelegramMessage({
          chatId,
          text: `✅ <b>已綁定</b>\n\n姓名：${staff.name}\n門市：${staff.store || '未設定'}\n角色：${staff.role}`,
        });
      }
      return NextResponse.json({ ok: true });
    }

    // 未知指令
    await sendTelegramMessage({
      chatId,
      text: '📋 <b>可用指令</b>\n\n/start - 查看綁定說明\n/bind 驗證碼 - 綁定帳號\n/status - 查看綁定狀態',
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

// GET: 健康檢查
export async function GET() {
  return NextResponse.json({ ok: true, service: 'telegram-webhook' });
}
