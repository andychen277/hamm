import { NextRequest, NextResponse } from 'next/server';
import { askQuestion } from '@/lib/ai-engine';

export async function POST(req: NextRequest) {
  try {
    const { question, context } = await req.json();

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: '請輸入問題' },
        { status: 400 }
      );
    }

    if (question.trim().length > 500) {
      return NextResponse.json(
        { success: false, error: '問題長度不可超過 500 字' },
        { status: 400 }
      );
    }

    const result = await askQuestion(question.trim(), context);

    return NextResponse.json({ success: !result.error, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
