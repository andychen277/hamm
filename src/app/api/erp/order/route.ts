import { NextRequest, NextResponse } from 'next/server';
import { createOrder, STORE_CODES } from '@/lib/erp';

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

    return NextResponse.json({
      success: true,
      data: {
        orderNumber: result.orderNumber,
        message: `客訂單 ${result.orderNumber} 建立成功`,
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
