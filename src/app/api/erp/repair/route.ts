import { NextRequest, NextResponse } from 'next/server';
import { createRepair, STORE_CODES } from '@/lib/erp';
import { query } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      phone,
      memberName,
      memberId,
      repairDesc,
      estimate,
      prepayment,
      technician,
      store,
      staffName,
      ccList,
    } = body;

    // Validation
    if (!phone || !memberName || !repairDesc || !store) {
      return NextResponse.json(
        { success: false, error: '缺少必要欄位：phone, memberName, repairDesc, store' },
        { status: 400 }
      );
    }

    const storeCode = STORE_CODES[store];
    if (!storeCode) {
      return NextResponse.json(
        { success: false, error: '無效的門市' },
        { status: 400 }
      );
    }

    const result = await createRepair(
      {
        phone,
        memberName,
        memberId,
        repairDesc,
        estimate: Number(estimate) || 0,
        prepayment: Number(prepayment) || 0,
        technician,
      },
      {
        store_code: storeCode,
        employee_name: staffName || 'Hamm',
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'ERP 寫入失敗' },
        { status: 500 }
      );
    }

    // Also insert into local DB for immediate visibility
    try {
      await query(`
        INSERT INTO repairs (
          repair_id, store, customer_name, customer_phone, repair_desc,
          estimate, deposit, open_date, status, staff_name, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (repair_id) DO NOTHING
      `, [
        result.repairNumber,
        store,
        memberName,
        phone,
        repairDesc,
        Number(estimate) || 0,
        Number(prepayment) || 0,
        new Date().toISOString().split('T')[0],
        '開單',
        staffName || 'Hamm'
      ]);
      console.log(`[Repair] 本地 DB 已寫入: ${result.repairNumber}`);
    } catch (dbError) {
      console.error('[Repair] 本地 DB 寫入失敗（ERP 已成功）:', dbError);
      // Don't fail the request - ERP write was successful
    }

    // Send Telegram notifications to CC recipients
    let notificationsSent = 0;
    if (ccList && Array.isArray(ccList) && ccList.length > 0) {
      const message = `🔧 <b>新維修單通知</b>

📝 單號：<code>${result.repairNumber}</code>
👤 客戶：${memberName}
📱 電話：${phone}
🏪 門市：${store}
🛠️ 維修：${repairDesc.substring(0, 100)}${repairDesc.length > 100 ? '...' : ''}
💰 預估：$${Number(estimate || 0).toLocaleString()}
👨‍💼 開單：${staffName || 'Hamm'}

⏰ ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;

      for (const staffNameCc of ccList) {
        try {
          const staffResult = await query(
            `SELECT telegram_chat_id FROM staff WHERE name = $1 AND telegram_chat_id IS NOT NULL`,
            [staffNameCc]
          );

          if (staffResult.rows.length > 0 && staffResult.rows[0].telegram_chat_id) {
            await sendTelegramMessage({
              chatId: staffResult.rows[0].telegram_chat_id,
              text: message,
            });
            notificationsSent++;
          }
        } catch {
          // ignore individual notification failures
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        repairNumber: result.repairNumber,
        message: `維修單 ${result.repairNumber} 建立成功`,
        notificationsSent,
      },
    });
  } catch (error) {
    console.error('ERP repair creation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'ERP 寫入失敗' },
      { status: 500 }
    );
  }
}
