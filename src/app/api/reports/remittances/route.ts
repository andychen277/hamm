import { NextRequest, NextResponse } from 'next/server';
import { queryRemittances } from '@/lib/erp';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const store = searchParams.get('store') || undefined;
    const status = searchParams.get('status') || undefined;
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    // 預設查詢最近 30 天
    const today = new Date();
    const defaultStart = new Date(today);
    defaultStart.setDate(defaultStart.getDate() - 30);

    const startDate = start || defaultStart.toISOString().split('T')[0];
    const endDate = end || today.toISOString().split('T')[0];

    const result = await queryRemittances(
      startDate,
      endDate,
      store,
      status
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || '查詢失敗' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data || [],
    });
  } catch (error) {
    console.error('Remittance query error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '查詢失敗' },
      { status: 500 }
    );
  }
}
