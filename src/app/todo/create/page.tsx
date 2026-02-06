'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

const STORES = ['台南', '高雄', '台中', '台北', '美術'];

interface StaffMember {
  id: number;
  name: string;
  store: string;
  telegram_user_id: string | null;
}

function CreateTodoForm() {
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

  // CC state
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [allStaffList, setAllStaffList] = useState<StaffMember[]>([]);
  const [ccList, setCcList] = useState<string[]>([]);
  const [showCcPicker, setShowCcPicker] = useState(false);
  const [showCreatorPicker, setShowCreatorPicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);

  // Get user info and fetch staff list
  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).catch(() => null),
      fetch('/api/staff').then(r => r.json()).catch(() => null),
    ]).then(([meJson, staffJson]) => {
      let userName = '';
      if (meJson?.success) {
        userName = meJson.user.name || '';
        if (userName) setCreator(userName);
        if (meJson.user.store_access?.[0] && meJson.user.store_access[0] !== 'all') {
          setStore(meJson.user.store_access[0]);
        }
      }
      if (staffJson?.success) {
        const sorted = [...staffJson.data].sort((a: StaffMember, b: StaffMember) => {
          if (a.name === userName) return -1;
          if (b.name === userName) return 1;
          return (a.store || '').localeCompare(b.store || '') || a.name.localeCompare(b.name);
        });
        setAllStaffList(sorted);
        setStaffList(sorted.filter((s: StaffMember) => s.telegram_user_id));
      }
    });
  }, []);

  const toggleCc = (name: string) => {
    setCcList(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  // Restore draft from session storage on mount
  useEffect(() => {
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
  }, []);

  // Receive callback data from quick-select pages
  useEffect(() => {
    const callbackData = sessionStorage.getItem('callback_data');
    if (callbackData) {
      try {
        const data = JSON.parse(callbackData);
        // Format related name based on type
        let name = '';
        if (data.type === 'inventory' || data.type === 'stock') {
          name = `${data.product_name} (${data.store})`;
          setRelatedId(data.product_id);
        } else if (data.type === 'member') {
          name = `${data.name} (${data.phone})`;
          setRelatedId(data.phone);
        } else if (data.type === 'product') {
          name = data.product_name;
          setRelatedId(data.product_id);
        } else if (data.type === 'repair') {
          name = `維修單 ${data.repair_id}`;
          setRelatedId(data.repair_id);
        } else if (data.type === 'customer_order' || data.type === 'order') {
          name = `客訂 ${data.customer_name} - ${data.product_info?.substring(0, 30) || ''}`;
          setRelatedId(data.order_id);
        }
        setRelatedName(name || data.product_name || data.name || '');
        setTaskType(data.type);
      } catch {
        // ignore
      }
      sessionStorage.removeItem('callback_data');
    }
  }, []);

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
          ccList: ccList.length > 0 ? ccList : undefined,
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
    const callbackUrl = '/todo/create';
    router.push(`${path}?callback=true&callback_type=${type}&return_url=${encodeURIComponent(callbackUrl)}`);
  };

  return (
    <>
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
            <label className="text-xs block mb-2" style={{ color: 'var(--color-text-muted)' }}>
              建檔人員 *
            </label>
            {creator && (
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  {creator}
                  <button type="button" onClick={() => setCreator('')} className="ml-1 opacity-80 hover:opacity-100">×</button>
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowCreatorPicker(!showCreatorPicker)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-secondary)' }}
            >
              {showCreatorPicker ? '收起' : creator ? '更換人員' : '選擇員工'}
            </button>
            {showCreatorPicker && allStaffList.length > 0 && (
              <div className="mt-2 p-2 rounded-lg max-h-48 overflow-y-auto" style={{ background: 'var(--color-bg-card-alt)' }}>
                <div className="space-y-1">
                  {allStaffList.map(staff => (
                    <button
                      key={staff.id}
                      type="button"
                      onClick={() => { setCreator(staff.name); setShowCreatorPicker(false); }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80"
                      style={{
                        background: creator === staff.name ? 'var(--color-accent)' : 'var(--color-bg-card)',
                        color: creator === staff.name ? '#fff' : 'var(--color-text-primary)',
                      }}
                    >
                      <span>{staff.name}</span>
                      <span className="text-xs opacity-70">{staff.store}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
            <label className="text-xs block mb-2" style={{ color: 'var(--color-text-muted)' }}>
              指派人員
            </label>
            {assignee && (
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  {assignee}
                  <button type="button" onClick={() => setAssignee('')} className="ml-1 opacity-80 hover:opacity-100">×</button>
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowAssigneePicker(!showAssigneePicker)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-secondary)' }}
            >
              {showAssigneePicker ? '收起' : assignee ? '更換人員' : '選擇員工'}
            </button>
            {showAssigneePicker && allStaffList.length > 0 && (
              <div className="mt-2 p-2 rounded-lg max-h-48 overflow-y-auto" style={{ background: 'var(--color-bg-card-alt)' }}>
                <div className="space-y-1">
                  {allStaffList.map(staff => (
                    <button
                      key={staff.id}
                      type="button"
                      onClick={() => { setAssignee(staff.name); setShowAssigneePicker(false); }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80"
                      style={{
                        background: assignee === staff.name ? 'var(--color-accent)' : 'var(--color-bg-card)',
                        color: assignee === staff.name ? '#fff' : 'var(--color-text-primary)',
                      }}
                    >
                      <span>{staff.name}</span>
                      <span className="text-xs opacity-70">{staff.store}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
          <label className="text-xs block mb-2" style={{ color: 'var(--color-text-muted)' }}>
            快取連結
          </label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleQuickLink('customer_order', '/reports/orders')}
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
            <button
              onClick={() => handleQuickLink('member', '/reports/members')}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
            >
              👥 快取會員
            </button>
          </div>

          {/* Action Links */}
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-bg-card-alt)' }}>
            <label className="text-xs block mb-2" style={{ color: 'var(--color-text-muted)' }}>
              建立單據
            </label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => router.push('/orders/create')}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'var(--color-accent)', color: '#fff' }}
              >
                📦 新增客訂
              </button>
              <button
                onClick={() => router.push('/repairs/create')}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'var(--color-accent)', color: '#fff' }}
              >
                🔧 新增維修
              </button>
              <button
                onClick={() => router.push('/remittance/create')}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'var(--color-warning)', color: '#fff' }}
              >
                💰 匯款需求
              </button>
            </div>
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

        {/* CC Recipients */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              📧 CC 副本通知（選填）
            </label>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {ccList.length > 0 ? `已選 ${ccList.length} 人` : ''}
            </span>
          </div>

          {ccList.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {ccList.map(name => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                >
                  {name}
                  <button type="button" onClick={() => toggleCc(name)} className="ml-1 opacity-60 hover:opacity-100">×</button>
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowCcPicker(!showCcPicker)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-secondary)' }}
          >
            {showCcPicker ? '收起' : '選擇通知對象'}
          </button>

          {showCcPicker && staffList.length > 0 && (
            <div className="mt-3 p-3 rounded-lg max-h-48 overflow-y-auto" style={{ background: 'var(--color-bg-card-alt)' }}>
              <div className="space-y-2">
                {staffList.map(staff => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => toggleCc(staff.name)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{
                      background: ccList.includes(staff.name) ? 'var(--color-accent)' : 'var(--color-bg-card)',
                      color: ccList.includes(staff.name) ? '#fff' : 'var(--color-text-primary)',
                    }}
                  >
                    <span>{staff.name}</span>
                    <span className="text-xs opacity-70">{staff.store}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
    </>
  );
}

export default function CreateTodoPage() {
  return (
    <div className="pb-20 min-h-screen">
      <Suspense fallback={
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      }>
        <CreateTodoForm />
      </Suspense>
      <BottomNav active="todo" />
    </div>
  );
}
