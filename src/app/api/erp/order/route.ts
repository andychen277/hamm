import { NextRequest, NextResponse } from 'next/server';
import { createOrder, STORE_CODES } from '@/lib/erp';
import { query } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      phone,
      memberName,
      memberId,
      productDesc,
      price,
      orderType,
      deliveryDate,
      prepay_cash,
      prepay_card,
      prepay_transfer,
      prepay_remit,
      store,
      staffName,
      ccList,
    } = body;

    // Validation
    if (!phone || !memberName || !productDesc || !price || !store) {
      return NextResponse.json(
        { success: false, error: '缺少必要欄位：phone, memberName, productDesc, price, store' },
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

    const result = await createOrder(
      {
        phone,
        memberName,
        memberId,
        productDesc,
        price: Number(price),
        orderType,
        deliveryDate,
        prepay_cash: Number(prepay_cash) || 0,
        prepay_card: Number(prepay_card) || 0,
        prepay_transfer: Number(prepay_transfer) || 0,
        prepay_remit: Number(prepay_remit) || 0,
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
      const totalPrepay = (Number(prepay_cash) || 0) + (Number(prepay_card) || 0) +
                          (Number(prepay_transfer) || 0) + (Number(prepay_remit) || 0);
      const balance = Number(price) - totalPrepay;
      await query(`
        INSERT INTO customer_orders (
          order_id, store, customer_name, customer_phone, product_info,
          total_amount, deposit_paid, balance, order_date, status, staff_name, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (order_id) DO NOTHING
      `, [
        result.orderNumber,
        store,
        memberName,
        phone,
        productDesc,
        Number(price),
        totalPrepay,
        balance,
        new Date().toISOString().split('T')[0],
        '開單',
        staffName || 'Hamm'
      ]);
      console.log(`[Order] 本地 DB 已寫入: ${result.orderNumber}`);
    } catch (dbError) {
      console.error('[Order] 本地 DB 寫入失敗（ERP 已成功）:', dbError);
      // Don't fail the request - ERP write was successful
    }

    // Send Telegram notifications to CC recipients
    let notificationsSent = 0;
    if (ccList && Array.isArray(ccList) && ccList.length > 0) {
      const message = `📋 <b>新客訂單通知</b>

📝 單號：<code>${result.orderNumber}</code>
👤 客戶：${memberName}
📱 電話：${phone}
🏪 門市：${store}
📦 商品：${productDesc.substring(0, 100)}${productDesc.length > 100 ? '...' : ''}
💰 金額：$${Number(price).toLocaleString()}
👨‍💼 開單：${staffName || 'Hamm'}

⏰ ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;

      for (const staffNameCc of ccList) {
        try {
          const staffResult = await query(
            `SELECT telegram_user_id FROM staff WHERE name = $1 AND telegram_user_id IS NOT NULL`,
            [staffNameCc]
          );

          if (staffResult.rows.length > 0 && staffResult.rows[0].telegram_user_id) {
            await sendTelegramMessage({
              chatId: staffResult.rows[0].telegram_user_id,
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
        orderNumber: result.orderNumber,
        message: `客訂單 ${result.orderNumber} 建立成功`,
        notificationsSent,
      },
    });
  } catch (error) {
    console.error('ERP order creation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'ERP 寫入失敗' },
      { status: 500 }
    );
  }
}
