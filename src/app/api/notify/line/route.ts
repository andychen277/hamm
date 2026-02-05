import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  pushMessage,
  findLineUserByPhone,
  buildOrderArrivalFlex,
  buildRepairCompleteFlex,
} from '@/lib/line';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, phone, customMessage } = body;

    if (!type || !phone) {
      return NextResponse.json(
        { success: false, error: '缺少必要參數: type, phone' },
        { status: 400 }
      );
    }

    // Find LINE user ID by phone
    const lineUserId = await findLineUserByPhone(phone);
    if (!lineUserId) {
      return NextResponse.json(
        { success: false, error: '此客戶尚未綁定 LINE，無法推播通知', notBound: true },
        { status: 404 }
      );
    }

    let message: object;

    if (type === 'order_arrived') {
      // Order arrival notification
      const { orderId } = body;
      if (!orderId) {
        return NextResponse.json(
          { success: false, error: '缺少 orderId' },
          { status: 400 }
        );
      }

      // Get order info
      const orderResult = await query(
        `SELECT order_id, store, product_info, total_amount, deposit_paid, balance
         FROM customer_orders WHERE order_id = $1`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: '找不到客訂單' },
          { status: 404 }
        );
      }

      const order = orderResult.rows[0];
      message = buildOrderArrivalFlex(
        {
          order_id: order.order_id,
          store: order.store,
          product_info: order.product_info,
          total_amount: Number(order.total_amount),
          deposit_paid: Number(order.deposit_paid),
          balance: Number(order.balance),
        },
        customMessage || undefined
      );

    } else if (type === 'repair_done') {
      // Repair completion notification
      const { repairId } = body;
      if (!repairId) {
        return NextResponse.json(
          { success: false, error: '缺少 repairId' },
          { status: 400 }
        );
      }

      // Get repair info
      const repairResult = await query(
        `SELECT repair_id, store, repair_desc, deposit, vendor_quote
         FROM repairs WHERE repair_id = $1`,
        [repairId]
      );

      if (repairResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: '找不到維修單' },
          { status: 404 }
        );
      }

      const repair = repairResult.rows[0];
      message = buildRepairCompleteFlex(
        {
          repair_id: repair.repair_id,
          store: repair.store,
          repair_desc: repair.repair_desc,
          deposit: Number(repair.deposit) || 0,
          vendor_quote: Number(repair.vendor_quote) || 0,
        },
        customMessage || undefined
      );

    } else {
      return NextResponse.json(
        { success: false, error: '不支援的通知類型' },
        { status: 400 }
      );
    }

    // Send the message
    const result = await pushMessage(lineUserId, [message]);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || '推播失敗' },
        { status: 500 }
      );
    }

    // Update status in local database after successful notification
    if (type === 'order_arrived') {
      const { orderId } = body;
      await query(
        `UPDATE customer_orders SET status = '通知', updated_at = NOW() WHERE order_id = $1`,
        [orderId]
      );
    } else if (type === 'repair_done') {
      const { repairId } = body;
      await query(
        `UPDATE repairs SET status = '已完修', updated_at = NOW() WHERE repair_id = $1`,
        [repairId]
      );
    }

    return NextResponse.json({
      success: true,
      message: '通知已發送',
    });

  } catch (error) {
    console.error('Notify API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '通知發送失敗' },
      { status: 500 }
    );
  }
}
