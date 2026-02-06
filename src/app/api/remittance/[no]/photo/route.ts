import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ no: string }> }
) {
  try {
    const { no } = await params;

    const result = await query(
      `SELECT photo_data FROM remittances WHERE remittance_no = $1`,
      [no]
    );

    if (result.rows.length === 0 || !result.rows[0].photo_data) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0].photo_data,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
