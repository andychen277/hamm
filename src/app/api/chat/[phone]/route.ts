import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface ChatMessage {
  direction: string;
  message_type: string;
  content: string;
  created_at: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const { phone } = await params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    // 用手機號碼查 line_user_id
    const bindingResult = await query<{ line_user_id: string }>(
      `SELECT line_user_id FROM line_bindings WHERE phone = $1 AND bound = true`,
      [phone]
    );

    if (bindingResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          bound: false,
          messages: [],
        },
      });
    }

    const lineUserId = bindingResult.rows[0].line_user_id;

    // 查詢聊天記錄
    const messagesResult = await query<ChatMessage>(
      `SELECT direction, message_type, content, TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at
       FROM chat_messages
       WHERE line_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [lineUserId, limit]
    );

    // 反轉順序，讓最舊的在前面
    const messages = messagesResult.rows.reverse();

    return NextResponse.json({
      success: true,
      data: {
        bound: true,
        lineUserId,
        messages: messages.map(m => ({
          direction: m.direction,
          type: m.message_type,
          content: m.content,
          time: m.created_at,
        })),
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}
