import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      remittanceNo,
      paidAmount,
      paidNote,
      creator,
      supplierName,
    } = body;

    if (!remittanceNo) {
      return NextResponse.json(
        { success: false, error: '缺少匯款單號' },
        { status: 400 }
      );
    }

    // Get current user from token for paidBy
    let paidBy = 'Hamm';
    const token = req.cookies.get('hamm_token')?.value;
    if (token) {
      const payload = verifyToken(token);
      if (payload?.name) paidBy = payload.name;
    }

    // Note: We cannot update ERP directly from Hamm (ERP is on internal network)
    // The status update in ERP should be done manually
    // Here we just send Telegram notification to the creator and CC recipients

    const notificationResults: { name: string; success: boolean; error?: string }[] = [];

    // Format notification message
    const message = `✅ <b>匯款完成通知</b>

📋 單號：<code>${remittanceNo}</code>
${supplierName ? `🏭 廠商：${supplierName}\n` : ''}💰 金額：$${(paidAmount || 0).toLocaleString()}
👤 匯款人：${paidBy}
${paidNote ? `\n💬 備註：${paidNote}` : ''}

⏰ ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;

    // 1. Notify the creator
    if (creator) {
      const staffResult = await query(
        `SELECT telegram_chat_id FROM staff WHERE name = $1 AND telegram_chat_id IS NOT NULL`,
        [creator]
      );

      if (staffResult.rows.length > 0 && staffResult.rows[0].telegram_chat_id) {
        const result = await sendTelegramMessage({
          chatId: staffResult.rows[0].telegram_chat_id,
          text: message,
        });
        notificationResults.push({
          name: creator,
          success: result.ok,
          error: result.ok ? undefined : result.description,
        });
      } else {
        notificationResults.push({
          name: creator,
          success: false,
          error: '找不到 Telegram ID',
        });
      }
    }

    // 2. Notify CC recipients
    const ccResult = await query(
      `SELECT staff_name FROM remittance_cc WHERE remittance_no = $1`,
      [remittanceNo]
    );

    for (const row of ccResult.rows) {
      const ccName = row.staff_name;
      // Skip if same as creator
      if (ccName === creator) continue;

      const staffResult = await query(
        `SELECT telegram_chat_id FROM staff WHERE name = $1 AND telegram_chat_id IS NOT NULL`,
        [ccName]
      );

      if (staffResult.rows.length > 0 && staffResult.rows[0].telegram_chat_id) {
        const ccMessage = `📧 <b>匯款完成通知（副本）</b>

📋 單號：<code>${remittanceNo}</code>
${supplierName ? `🏭 廠商：${supplierName}\n` : ''}💰 金額：$${(paidAmount || 0).toLocaleString()}
👤 匯款人：${paidBy}
📝 建檔人：${creator || '未知'}
${paidNote ? `\n💬 備註：${paidNote}` : ''}

⏰ ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;

        const result = await sendTelegramMessage({
          chatId: staffResult.rows[0].telegram_chat_id,
          text: ccMessage,
        });
        notificationResults.push({
          name: ccName,
          success: result.ok,
          error: result.ok ? undefined : result.description,
        });
      } else {
        notificationResults.push({
          name: ccName,
          success: false,
          error: '找不到 Telegram ID',
        });
      }
    }

    const successCount = notificationResults.filter(r => r.success).length;
    const failCount = notificationResults.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      data: {
        remittanceNo,
        paidAmount,
        paidBy,
        notifications: {
          sent: successCount,
          failed: failCount,
          details: notificationResults,
        },
      },
    });
  } catch (error) {
    console.error('Complete remittance error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '操作失敗' },
      { status: 500 }
    );
  }
}
