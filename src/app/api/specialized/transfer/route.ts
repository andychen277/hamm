import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createStoreTransfer, STORE_CODES } from '@/lib/erp';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const { from_store, to_store, memo } = await req.json();

    if (!from_store || !to_store) {
      return NextResponse.json(
        { success: false, error: '請提供調出門市和調入門市' },
        { status: 400 }
      );
    }

    const fromCode = STORE_CODES[from_store];
    const toCode = STORE_CODES[to_store];

    if (!fromCode || !toCode) {
      return NextResponse.json(
        { success: false, error: '無效的門市' },
        { status: 400 }
      );
    }

    const result = await createStoreTransfer(
      fromCode,
      toCode,
      session?.name || 'Hamm',
      memo || ''
    );

    return NextResponse.json({ success: result.success, data: result });
  } catch (error) {
    console.error('Transfer error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
