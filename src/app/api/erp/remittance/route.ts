import { NextRequest, NextResponse } from 'next/server';
import { createRemittance, STORE_CODES } from '@/lib/erp';
import { query } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      store,
      creator,
      supplierName,
      amount,
      requestDate,
      arrivalStore,
      description,
      ccList,
      photoData,
    } = body;

    // Validation
    if (!store || !creator || !supplierName || !amount) {
      return NextResponse.json(
        { success: false, error: '缺少必要欄位：store, creator, supplierName, amount' },
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

    const result = await createRemittance(
      {
        store,
        creator,
        supplierName,
        amount: Number(amount),
        requestDate: requestDate || new Date().toISOString().split('T')[0],
        arrivalStore: arrivalStore || store,
        description: description || '',
      },
      storeCode
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
        INSERT INTO remittances (
          remittance_no, store, creator, supplier_name, amount,
          request_date, arrival_store, description, status, photo_data, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (remittance_no) DO NOTHING
      `, [
        result.remittanceNo,
        store,
        creator,
        supplierName,
        Number(amount),
        requestDate || new Date().toISOString().split('T')[0],
        arrivalStore || store,
        description || '',
        '開單',
        photoData || null,
      ]);
      console.log(`[Remittance] 本地 DB 已寫入: ${result.remittanceNo}`);
    } catch (dbError) {
      console.error('[Remittance] 本地 DB 寫入失敗（ERP 已成功）:', dbError);
      // Don't fail the request - ERP write was successful
    }

    // Send Telegram notifications to CC recipients
    let notificationsSent = 0;
    if (ccList && Array.isArray(ccList) && ccList.length > 0) {
      const message = `💰 <b>新匯款需求通知</b>

📝 單號：<code>${result.remittanceNo}</code>
🏭 廠商：${supplierName}
💵 金額：$${Number(amount).toLocaleString()}
🏪 匯款門市：${store}
📦 到貨門市：${arrivalStore || store}
📋 說明：${description ? description.substring(0, 100) + (description.length > 100 ? '...' : '') : '無'}${photoData ? '\n📷 含附件照片' : ''}
👨‍💼 建檔：${creator}

⏰ ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;

      for (const staffNameCc of ccList) {
        try {
          // Save to CC table
          await query(
            `INSERT INTO remittance_cc (remittance_no, staff_name) VALUES ($1, $2)`,
            [result.remittanceNo, staffNameCc]
          );

          // Send Telegram notification
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
        remittanceNo: result.remittanceNo,
        message: `匯款需求 ${result.remittanceNo} 建立成功`,
        notificationsSent,
      },
    });
  } catch (error) {
    console.error('ERP remittance creation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'ERP 寫入失敗' },
      { status: 500 }
    );
  }
}
