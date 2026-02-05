import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/todos/[id] - Get single todo
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await query(
      `SELECT * FROM todos WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '找不到任務' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}

// PUT /api/todos/[id] - Update todo
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { assignee, task_type, related_id, related_name, description, status } = body;

    // Build dynamic update query
    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (assignee !== undefined) {
      updates.push(`assignee = $${paramIndex++}`);
      values.push(assignee);
    }
    if (task_type !== undefined) {
      updates.push(`task_type = $${paramIndex++}`);
      values.push(task_type);
    }
    if (related_id !== undefined) {
      updates.push(`related_id = $${paramIndex++}`);
      values.push(related_id);
    }
    if (related_name !== undefined) {
      updates.push(`related_name = $${paramIndex++}`);
      values.push(related_name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
      if (status === 'completed') {
        updates.push(`completed_at = NOW()`);
      }
    }

    values.push(id);

    const result = await query(
      `UPDATE todos SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '找不到任務' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 }
    );
  }
}

// DELETE /api/todos/[id] - Delete todo
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await query(
      `DELETE FROM todos WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '找不到任務' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '任務已刪除',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
