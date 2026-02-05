import { NextRequest, NextResponse } from 'next/server';
import { createRepair, STORE_CODES } from '@/lib/erp';

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

    return NextResponse.json({
      success: true,
      data: {
        repairNumber: result.repairNumber,
        message: `維修單 ${result.repairNumber} 建立成功`,
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
