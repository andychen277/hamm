'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

interface Staff {
  id: number;
  name: string;
  store: string;
  role: string;
  line_bound: boolean;
  line_user_id: string | null;
  telegram_bound: boolean;
  telegram_username: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [bindCode, setBindCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [lineIdInput, setLineIdInput] = useState('');

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/staff');
      const json = await res.json();
      if (json.success) {
        setStaffList(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const generateBindCode = async (staff: Staff) => {
    setGenerating(true);
    setSelectedStaff(staff);
    setBindCode(null);

    try {
      const res = await fetch('/api/staff/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: staff.id }),
      });
      const json = await res.json();

      if (json.success) {
        setBindCode(json.data.bindCode);
      }
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const saveLineId = async (staffId: number, lineUserId: string) => {
    try {
      const res = await fetch(`/api/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_user_id: lineUserId || null }),
      });
      const json = await res.json();
      if (json.success) {
        setEditingLineId(null);
        setLineIdInput('');
        fetchStaff();
      }
    } catch {
      // ignore
    }
  };

  const clearLineId = async (staffId: number) => {
    if (!confirm('確定要解除此員工的 LINE 綁定嗎？')) return;
    await saveLineId(staffId, '');
  };

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          ⚙️ 設定
        </h1>
      </div>

      <div className="px-5">
        {/* LINE Login Binding Section */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
          <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            🔐 LINE 登入權限
          </h3>

          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            員工綁定 LINE 後可使用 LINE 登入 Hamm 系統。
            <br />
            員工首次點擊 LINE 登入會顯示 LINE ID，複製後貼到這裡。
          </p>

          {loading ? (
            <div className="flex items-center justify-center h-20">
              <div className="w-6 h-6 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <div className="space-y-2">
              {staffList.map((staff) => (
                <div
                  key={`line-${staff.id}`}
                  className="p-3 rounded-xl"
                  style={{ background: 'var(--color-bg-card-alt)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {staff.name}
                      </span>
                      <span className="text-xs ml-2 px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}>
                        {staff.role}
                      </span>
                      {staff.store && (
                        <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>
                          {staff.store}
                        </span>
                      )}
                    </div>
                    {staff.line_bound ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-full"
                          style={{ background: 'var(--color-positive)', color: '#fff' }}>
                          ✓ 已綁定
                        </span>
                        <button
                          onClick={() => clearLineId(staff.id)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ color: 'var(--color-negative)' }}
                        >
                          解除
                        </button>
                      </div>
                    ) : editingLineId === staff.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={lineIdInput}
                          onChange={e => setLineIdInput(e.target.value)}
                          placeholder="貼上 LINE ID"
                          className="w-32 text-xs px-2 py-1 rounded outline-none"
                          style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
                        />
                        <button
                          onClick={() => saveLineId(staff.id, lineIdInput)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: 'var(--color-positive)', color: '#fff' }}
                        >
                          儲存
                        </button>
                        <button
                          onClick={() => { setEditingLineId(null); setLineIdInput(''); }}
                          className="text-xs px-2 py-1"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingLineId(staff.id)}
                        className="text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: 'var(--color-accent)', color: '#fff' }}
                      >
                        綁定 LINE
                      </button>
                    )}
                  </div>
                  {staff.line_user_id && (
                    <div className="text-xs font-mono truncate" style={{ color: 'var(--color-text-muted)' }}>
                      {staff.line_user_id}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Telegram Binding Section */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
          <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            📱 Telegram 通知綁定
          </h3>

          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            綁定後，當有新任務指派給您時，會透過 Telegram 推送通知。
          </p>

          {loading ? (
            <div className="flex items-center justify-center h-20">
              <div className="w-6 h-6 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <div className="space-y-2">
              {staffList.map((staff) => (
                <div
                  key={staff.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--color-bg-card-alt)' }}
                >
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {staff.name}
                    </span>
                    {staff.store && (
                      <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
                        {staff.store}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {staff.telegram_bound ? (
                      <span className="text-xs px-2 py-1 rounded-full"
                        style={{ background: 'var(--color-positive)', color: '#fff' }}>
                        ✓ 已綁定
                      </span>
                    ) : (
                      <button
                        onClick={() => generateBindCode(staff)}
                        disabled={generating && selectedStaff?.id === staff.id}
                        className="text-xs px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-50"
                        style={{ background: 'var(--color-accent)', color: '#fff' }}
                      >
                        {generating && selectedStaff?.id === staff.id ? '產生中...' : '綁定'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bind Code Modal */}
        {bindCode && selectedStaff && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
            <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              🔐 綁定驗證碼 - {selectedStaff.name}
            </h3>

            <div className="text-center py-4">
              <div
                className="text-2xl font-mono font-bold tracking-widest mb-2"
                style={{ color: 'var(--color-accent)' }}
              >
                {bindCode}
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                驗證碼 10 分鐘內有效
              </p>
            </div>

            <div className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <p><b>步驟：</b></p>
              <p>1. 在 Telegram 搜尋 <b>@Forge277bot</b></p>
              <p>2. 傳送以下訊息：</p>
            </div>

            <div
              className="mt-2 p-3 rounded-lg font-mono text-sm flex items-center justify-between"
              style={{ background: 'var(--color-bg-card-alt)' }}
            >
              <span style={{ color: 'var(--color-text-primary)' }}>/bind {bindCode}</span>
              <button
                onClick={() => copyToClipboard(`/bind ${bindCode}`)}
                className="text-xs px-2 py-1 rounded"
                style={{ background: 'var(--color-accent)', color: '#fff' }}
              >
                複製
              </button>
            </div>

            <button
              onClick={() => {
                setBindCode(null);
                setSelectedStaff(null);
                fetchStaff(); // Refresh list
              }}
              className="w-full mt-4 py-2 rounded-lg text-sm"
              style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-secondary)' }}
            >
              關閉
            </button>
          </div>
        )}

        {/* Bot Link */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
          <h3 className="text-[13px] font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            🤖 277 Bike 工作通知 Bot
          </h3>
          <a
            href="https://t.me/Forge277bot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline"
            style={{ color: 'var(--color-accent)' }}
          >
            t.me/Forge277bot →
          </a>
        </div>

        {/* Logout */}
        <a
          href="/api/auth/logout"
          className="block w-full py-3 rounded-2xl text-center text-sm font-medium"
          style={{ background: 'var(--color-bg-card)', color: 'var(--color-negative)' }}
        >
          登出
        </a>
      </div>

      <BottomNav active="reports" />
    </div>
  );
}
