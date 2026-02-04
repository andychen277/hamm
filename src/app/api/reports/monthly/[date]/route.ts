import { NextRequest, NextResponse } from 'next/server';
import { generateMonthlyReport } from '@/lib/report-generator';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  try {
    const { date } = await params;
    // Accept YYYY-MM or YYYY-MM-DD
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(date)) {
      return NextResponse.json({ success: false, error: '日期格式錯誤 (YYYY-MM)' }, { status: 400 });
    }
    const report = await generateMonthlyReport(date);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
