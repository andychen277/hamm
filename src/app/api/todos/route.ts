import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendTaskNotification } from '@/lib/telegram';

// GET /api/todos - List todos
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const store = searchParams.get('store');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    let sql = `
      SELECT id, creator, store, assignee, task_type, related_id, related_name,
             description, status, created_at, updated_at, completed_at
      FROM todos
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (store) {
      sql += ` AND store = $${paramIndex++}`;
      params.push(store);
    }

    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}

// POST /api/todos - Create todo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { creator, store, assignee, task_type, related_id, related_name, description, ccList } = body;

    if (!creator || !store) {
      return NextResponse.json(
        { success: false, error: '建檔人員和指派門市為必填' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO todos (creator, store, assignee, task_type, related_id, related_name, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [creator, store, assignee || null, task_type || 'general', related_id || null, related_name || null, description || null]
    );

    const newTodo = result.rows[0];

    // 發送 Telegram 通知給被指派者
    if (assignee) {
      try {
        const staffResult = await query(
          `SELECT telegram_chat_id FROM staff WHERE name = $1 AND is_active = true`,
          [assignee]
        );

        if (staffResult.rows.length > 0 && staffResult.rows[0].telegram_chat_id) {
          await sendTaskNotification({
            chatId: staffResult.rows[0].telegram_chat_id,
            taskType: task_type || 'general',
            creator,
            store,
            assignee,
            relatedName: related_name,
            description,
            taskId: newTodo.id,
          });
        }
      } catch (notifyError) {
        console.error('Telegram notification failed:', notifyError);
        // 不影響任務建立結果
      }
    }

    // 發送 CC 副本通知
    let ccNotificationsSent = 0;
    if (ccList && Array.isArray(ccList) && ccList.length > 0) {
      for (const ccName of ccList) {
        // Skip if same as assignee (already notified)
        if (ccName === assignee) continue;

        try {
          const staffResult = await query(
            `SELECT telegram_chat_id FROM staff WHERE name = $1 AND telegram_chat_id IS NOT NULL`,
            [ccName]
          );

          if (staffResult.rows.length > 0 && staffResult.rows[0].telegram_chat_id) {
            await sendTaskNotification({
              chatId: staffResult.rows[0].telegram_chat_id,
              taskType: task_type || 'general',
              creator,
              store,
              assignee: assignee || '未指定',
              relatedName: related_name,
              description: `[CC 副本] ${description || ''}`,
              taskId: newTodo.id,
            });
            ccNotificationsSent++;
          }
        } catch {
          // ignore individual notification failures
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: newTodo,
      notificationsSent: ccNotificationsSent + (assignee ? 1 : 0),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Create failed' },
      { status: 500 }
    );
  }
}
