'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';

interface Todo {
  id: number;
  creator: string;
  store: string;
  assignee: string | null;
  task_type: string;
  related_id: string | null;
  related_name: string | null;
  description: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
}

const STORE_COLORS: Record<string, string> = {
  '台南': 'var(--color-store-tainan)',
  '高雄': 'var(--color-store-kaohsiung)',
  '台中': 'var(--color-store-taichung)',
  '台北': 'var(--color-store-taipei)',
  '美術': 'var(--color-store-meishu)',
};

const TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  'order': { label: '客訂', emoji: '📦' },
  'stock': { label: '預貨', emoji: '📋' },
  'repair': { label: '維修', emoji: '🔧' },
  'general': { label: '一般', emoji: '📝' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  'pending': { label: '待處理', color: 'var(--color-warning)' },
  'in_progress': { label: '進行中', color: 'var(--color-accent)' },
  'completed': { label: '已完成', color: 'var(--color-positive)' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function TodoPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    try {
      const status = filter === 'all' ? '' : filter;
      const res = await fetch(`/api/todos${status ? `?status=${status}` : ''}`);
      const json = await res.json();
      if (json.success) setTodos(json.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTodos();
    } catch {
      // ignore
    }
  };

  return (
    <div className="pb-20 min-h-screen">
      {/* Header - extra top padding for Safari safe area */}
      <div className="px-5 pt-14 pb-3 flex items-center justify-between" style={{ paddingTop: 'max(3.5rem, env(safe-area-inset-top, 3.5rem))' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          📋 任務管理
        </h1>
        <Link
          href="/todo/create"
          className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          + 新增
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="px-5 mb-4">
        <div className="flex gap-2">
          {(['pending', 'all', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: filter === f ? 'var(--color-accent)' : 'var(--color-bg-card)',
                color: filter === f ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              {f === 'pending' ? '待處理' : f === 'completed' ? '已完成' : '全部'}
            </button>
          ))}
        </div>
      </div>

      {/* Todo List */}
      <div className="px-5">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
              style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : todos.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {filter === 'pending' ? '目前沒有待處理的任務' : '沒有任務'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {todos.map((todo) => {
              const typeInfo = TYPE_LABELS[todo.task_type] || TYPE_LABELS.general;
              const statusInfo = STATUS_LABELS[todo.status] || STATUS_LABELS.pending;
              const storeColor = STORE_COLORS[todo.store] || '#64748b';

              return (
                <div
                  key={todo.id}
                  className="rounded-2xl p-4"
                  style={{ background: 'var(--color-bg-card)' }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{typeInfo.emoji}</span>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ background: storeColor, color: '#fff' }}
                      >
                        {todo.store}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ background: statusInfo.color, color: '#fff' }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {formatDate(todo.created_at)}
                    </span>
                  </div>

                  {/* Related Item */}
                  {todo.related_name && (
                    <div className="mb-2">
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {typeInfo.label}：
                      </span>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-accent)' }}>
                        {todo.related_name}
                      </span>
                    </div>
                  )}

                  {/* Description */}
                  {todo.description && (
                    <p className="text-sm mb-2" style={{ color: 'var(--color-text-primary)' }}>
                      {todo.description}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--color-bg-card-alt)' }}>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      <span>建檔：{todo.creator}</span>
                      {todo.assignee && <span className="ml-2">指派：{todo.assignee}</span>}
                    </div>

                    {/* Quick Actions */}
                    {todo.status !== 'completed' && (
                      <div className="flex gap-2">
                        {todo.status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange(todo.id, 'in_progress')}
                            className="px-3 py-1 rounded-lg text-xs"
                            style={{ background: 'var(--color-accent)', color: '#fff' }}
                          >
                            開始
                          </button>
                        )}
                        <button
                          onClick={() => handleStatusChange(todo.id, 'completed')}
                          className="px-3 py-1 rounded-lg text-xs"
                          style={{ background: 'var(--color-positive)', color: '#fff' }}
                        >
                          完成
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav active="todo" />
    </div>
  );
}
