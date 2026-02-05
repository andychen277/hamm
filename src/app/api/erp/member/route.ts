import { NextRequest, NextResponse } from 'next/server';
import { lookupMember, STORE_CODES } from '@/lib/erp';

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone');
  const store = req.nextUrl.searchParams.get('store') || '台南';

  if (!phone) {
    return NextResponse.json(
      { success: false, error: '請提供手機號碼' },
      { status: 400 }
    );
  }

  try {
    const storeCode = STORE_CODES[store] || '001';
    const member = await lookupMember(phone, storeCode);

    if (!member) {
      return NextResponse.json({
        success: true,
        data: null,
        message: '查無此會員',
      });
    }

    return NextResponse.json({
      success: true,
      data: member,
    });
  } catch (error) {
    console.error('ERP member lookup error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'ERP 查詢失敗' },
      { status: 500 }
    );
  }
}
