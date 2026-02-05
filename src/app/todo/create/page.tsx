'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';

const STORES = ['台南', '高雄', '台中', '台北', '美術'];

export default function CreateTodoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill from URL params (from quick links)
  const preType = searchParams.get('type') || 'general';
  const preRelatedId = searchParams.get('related_id') || '';
  const preRelatedName = searchParams.get('related_name') || '';

  const [creator, setCreator] = useState('');
  const [store, setStore] = useState('台南');
  const [assignee, setAssignee] = useState('');
  const [taskType, setTaskType] = useState(preType);
  const [relatedId, setRelatedId] = useState(preRelatedId);
  const [relatedName, setRelatedName] = useState(preRelatedName);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!creator.trim()) {
      alert('請輸入建檔人員');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator: creator.trim(),
          store,
          assignee: assignee.trim() || null,
          task_type: taskType,
          related_id: relatedId || null,
          related_name: relatedName || null,
          description: description.trim() || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push('/todo');
      } else {
        alert(json.error || '建立失敗');
      }
    } catch {
      alert('建立失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLink = (type: string, path: string) => {
    // Store current form state in session storage
    sessionStorage.setItem('todo_draft', JSON.stringify({
      creator,
      store,
      assignee,
      description,
    }));
    // Navigate to selection page with callback
    router.push(`${path}?todo_callback=true&type=${type}`);
  };

  // Restore draft from session storage on mount
  useState(() => {
    const draft = sessionStorage.getItem('todo_draft');
    if (draft) {
      try {
        const data = JSON.parse(draft);
        if (data.creator) setCreator(data.creator);
        if (data.store) setStore(data.store);
        if (data.assignee) setAssignee(data.assignee);
        if (data.description) setDescription(data.description);
      } catch {
        // ignore
      }
      sessionStorage.removeItem('todo_draft');
    }
  });

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          新增任務
        </h1>
      </div>

      <div className="px-5">
        {/* Form */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
          {/* Creator */}
          <div className="mb-4">
            <label className="text-xs block mb-1" style={{ color: 'var(--color-text-muted)' }}>
              建檔人員 *
            </label>
            <input
              type="text"
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
              placeholder="輸入姓名..."
              className="w-full h-11 px-4 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--color-bg-card-alt)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          {/* Store */}
          <div className="mb-4">
            <label className="text-xs block mb-1" style={{ color: 'var(--color-text-muted)' }}>
              指派門市 *
            </label>
            <select
              value={store}
              onChange={(e) => setStore(e.target.value)}
              className="w-full h-11 px-4 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--color-bg-card-alt)',
                color: 'var(--color-text-primary)',
              }}
            >
              {STORES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Assignee */}
          <div className="mb-4">
            <label className="text-xs block mb-1" style={{ color: 'var(--color-text-muted)' }}>
              指派人員
            </label>
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="輸入姓名..."
              className="w-full h-11 px-4 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--color-bg-card-alt)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
        </div>

        {/* Quick Links */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
          <label className="text-xs block mb-2" style={{ color: 'var(--color-text-muted)' }}>
            快取連結
          </label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleQuickLink('order', '/reports/members')}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
            >
              📦 快取客訂
            </button>
            <button
              onClick={() => handleQuickLink('stock', '/reports/inventory')}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
            >
              📋 快取預貨
            </button>
            <button
              onClick={() => handleQuickLink('repair', '/reports/repairs')}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
            >
              🔧 快取維修
            </button>
          </div>

          {/* Show selected related item */}
          {relatedName && (
            <div className="mt-3 p-3 rounded-xl" style={{ background: 'var(--color-bg-card-alt)' }}>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                已選擇：
              </span>
              <span className="text-sm font-medium ml-1" style={{ color: 'var(--color-accent)' }}>
                {relatedName}
              </span>
              <button
                onClick={() => { setRelatedId(''); setRelatedName(''); setTaskType('general'); }}
                className="ml-2 text-xs"
                style={{ color: 'var(--color-negative)' }}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
          <label className="text-xs block mb-2" style={{ color: 'var(--color-text-muted)' }}>
            交辦事項
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="輸入任務內容..."
            rows={4}
            className="w-full p-3 rounded-xl text-sm outline-none resize-none"
            style={{
              background: 'var(--color-bg-card-alt)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !creator.trim()}
          className="w-full h-12 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          {submitting ? '建立中...' : '建立任務'}
        </button>
      </div>

      <BottomNav active="todo" />
    </div>
  );
}
