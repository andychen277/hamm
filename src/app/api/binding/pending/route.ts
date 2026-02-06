import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// 確保 verified_by 欄位存在
let columnChecked = false;
async function ensureVerifiedByColumn() {
  if (columnChecked) return;
  try {
    await query(`ALTER TABLE line_bindings ADD COLUMN IF NOT EXISTS verified_by VARCHAR(100)`);
    columnChecked = true;
  } catch {
    // Column might already exist or table structure issue, ignore
    columnChecked = true;
  }
}

// GET /api/binding/pending - 列出所有待驗證的綁定請求 + 已驗證歷史
export async function GET(req: NextRequest) {
  try {
    await ensureVerifiedByColumn();
    const { searchParams } = new URL(req.url);
    const includeHistory = searchParams.get('history') === 'true';

    // 查詢所有待驗證的綁定記錄（未過期的）
    const pendingResult = await query(`
      SELECT
        b.id,
        b.line_user_id,
        b.phone,
        b.verification_code,
        b.code_expires_at,
        b.bind_status,
        b.created_at,
        m.name as member_name,
        m.member_level,
        m.total_spent
      FROM line_bindings b
      LEFT JOIN unified_members m ON b.member_id = m.id
      WHERE b.bind_status = 'pending'
        AND b.code_expires_at > NOW()
      ORDER BY b.created_at DESC
      LIMIT 50
    `);

    const bindings = pendingResult.rows.map(row => ({
      id: row.id,
      lineUserId: row.line_user_id,
      phone: row.phone,
      memberName: row.member_name,
      memberLevel: row.member_level,
      totalSpent: row.total_spent,
      createdAt: row.created_at,
      expiresAt: row.code_expires_at,
      remainingSeconds: Math.max(0, Math.floor((new Date(row.code_expires_at).getTime() - Date.now()) / 1000)),
    }));

    // 如果需要歷史記錄
    let history: Array<{
      id: number;
      phone: string;
      memberName: string;
      verifiedBy: string | null;
      verifiedAt: string;
    }> = [];

    if (includeHistory) {
      const historyResult = await query(`
        SELECT
          b.id,
          b.phone,
          b.verified_by,
          b.verified_at,
          m.name as member_name
        FROM line_bindings b
        LEFT JOIN unified_members m ON b.member_id = m.id
        WHERE b.bind_status = 'verified'
        ORDER BY b.verified_at DESC
        LIMIT 20
      `);

      history = historyResult.rows.map(row => ({
        id: row.id,
        phone: row.phone,
        memberName: row.member_name,
        verifiedBy: row.verified_by,
        verifiedAt: row.verified_at,
      }));
    }

    return NextResponse.json({
      success: true,
      data: bindings,
      history,
    });
  } catch (error) {
    console.error('Binding list error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '查詢失敗' },
      { status: 500 }
    );
  }
}

// POST /api/binding/pending - 員工直接完成綁定
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lineUserId, verifiedBy } = body;

    if (!lineUserId) {
      return NextResponse.json(
        { success: false, error: '缺少 lineUserId' },
        { status: 400 }
      );
    }

    // 查詢待驗證的綁定記錄
    const bindingResult = await query(`
      SELECT b.*, m.name, m.total_spent, m.member_level
      FROM line_bindings b
      JOIN unified_members m ON b.member_id = m.id
      WHERE b.line_user_id = $1 AND b.bind_status = 'pending'
    `, [lineUserId]);

    if (bindingResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '找不到待驗證的綁定請求' },
        { status: 404 }
      );
    }

    const binding = bindingResult.rows[0];

    // 檢查是否過期
    if (new Date() > new Date(binding.code_expires_at)) {
      return NextResponse.json(
        { success: false, error: '綁定請求已過期，請客戶重新輸入「綁定 手機號碼」' },
        { status: 400 }
      );
    }

    // 完成綁定（記錄認證人）
    await query(`
      UPDATE line_bindings
      SET bind_status = 'verified', verified_at = NOW(), verified_by = $2
      WHERE line_user_id = $1
    `, [lineUserId, verifiedBy || null]);

    await query(`
      UPDATE unified_members
      SET line_user_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [lineUserId, binding.member_id]);

    // 發送 LINE 通知給客戶
    try {
      const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (LINE_TOKEN) {
        const levelEmoji: Record<string, string> = {
          'vip': '👑 VIP',
          'gold': '🥇 金卡',
          'silver': '🥈 銀卡',
          'normal': '🎫 一般'
        };

        const message = `🎉 綁定成功！\n\n會員：${binding.name}\n等級：${levelEmoji[binding.member_level] || binding.member_level}\n累計消費：NT$${Math.round(binding.total_spent).toLocaleString()}\n\n現在您可以輸入「我的消費」查詢消費紀錄，或輸入「會員資訊」查看詳細會員資料。`;

        await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LINE_TOKEN}`,
          },
          body: JSON.stringify({
            to: lineUserId,
            messages: [{ type: 'text', text: message }],
          }),
        });
      }
    } catch (lineError) {
      console.error('LINE notification failed:', lineError);
      // 不影響綁定結果
    }

    return NextResponse.json({
      success: true,
      data: {
        phone: binding.phone,
        memberName: binding.name,
        message: `會員 ${binding.name}（${binding.phone}）綁定成功`,
      },
    });
  } catch (error) {
    console.error('Binding verify error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '驗證失敗' },
      { status: 500 }
    );
  }
}
