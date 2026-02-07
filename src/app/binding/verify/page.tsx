'use client';

import { useState, useEffect, useCallback } from 'react';
import BottomNav from '@/components/BottomNav';

interface BindingData {
  id: number;
  lineUserId: string;
  phone: string;
  memberName: string;
  memberLevel: string;
  totalSpent: number;
  createdAt: string;
  expiresAt: string;
  remainingSeconds: number;
}

interface HistoryItem {
  id: number;
  phone: string;
  memberName: string;
  verifiedBy: string | null;
  verifiedAt: string;
}

const LEVEL_LABELS: Record<string, string> = {
  vip: 'VIP',
  gold: '金卡',
  silver: '銀卡',
  normal: '一般',
};

export default function BindingVerifyPage() {
  const [loading, setLoading] = useState(true);
  const [bindings, setBindings] = useState<BindingData[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ lineUserId: string; memberName: string; phone: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string>('');

  // Get staff name from localStorage on mount
  useEffect(() => {
    const name = localStorage.getItem('staffName') || '';
    setStaffName(name);
  }, []);

  const fetchBindings = useCallback(async () => {
    try {
      const res = await fetch('/api/binding/pending?history=true');
      const json = await res.json();

      if (json.success) {
        setBindings(json.data);
        setHistory(json.history || []);
      }
    } catch {
      console.error('Failed to fetch bindings');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch bindings on mount and every 10 seconds
  useEffect(() => {
    fetchBindings();
    const interval = setInterval(fetchBindings, 10000);
    return () => clearInterval(interval);
  }, [fetchBindings]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setBindings(prev =>
        prev
          .map(b => ({
            ...b,
            remainingSeconds: Math.max(0, b.remainingSeconds - 1),
          }))
          .filter(b => b.remainingSeconds > 0)
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleVerify = async (lineUserId: string, memberName: string, phone: string) => {
    setVerifying(lineUserId);
    setConfirmTarget(null);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/binding/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId, verifiedBy: staffName || '門市人員' }),
      });

      const json = await res.json();

      if (json.success) {
        setSuccess(json.data.message);
        // Remove from list and add to history
        setBindings(prev => prev.filter(b => b.lineUserId !== lineUserId));
        setHistory(prev => [{
          id: Date.now(),
          phone,
          memberName,
          verifiedBy: staffName || '門市人員',
          verifiedAt: new Date().toISOString(),
        }, ...prev].slice(0, 20));
      } else {
        setError(json.error || '驗證失敗');
      }
    } catch {
      setError('網路錯誤，請重試');
    } finally {
      setVerifying(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCreatedAt = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatHistoryTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-4" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
              會員綁定驗證
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              點擊「驗證」完成客戶的 LINE 綁定
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchBindings(); }}
            className="px-3 py-2 rounded-lg text-xs"
            style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)' }}
          >
            重新整理
          </button>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Success Message */}
        {success && (
          <div
            className="rounded-2xl p-4 text-sm"
            style={{ background: '#dcfce7', color: '#16a34a' }}
          >
            ✅ {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div
            className="rounded-2xl p-4 text-sm"
            style={{ background: '#fee2e2', color: '#dc2626' }}
          >
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-8">
            <div
              className="inline-block w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {/* Empty State */}
        {!loading && bindings.length === 0 && (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: 'var(--color-bg-card)' }}
          >
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              目前沒有待驗證的綁定請求
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              請客戶在 LINE 輸入「綁定 手機號碼」
            </p>
          </div>
        )}

        {/* Binding List */}
        {!loading && bindings.length > 0 && (
          <div className="space-y-3">
            {bindings.map(binding => (
              <div
                key={binding.id}
                className="rounded-2xl p-4"
                style={{ background: 'var(--color-bg-card)' }}
              >
                <div className="flex items-start justify-between">
                  {/* Member Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {binding.memberName}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-muted)' }}
                      >
                        {LEVEL_LABELS[binding.memberLevel] || binding.memberLevel}
                      </span>
                    </div>
                    <p className="text-4xl font-black mt-2 tracking-wide" style={{ color: 'var(--color-text-primary)' }}>
                      {binding.phone}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      累計消費 ${Math.round(binding.totalSpent).toLocaleString()}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {formatCreatedAt(binding.createdAt)} 發起
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          background: binding.remainingSeconds < 60 ? '#fee2e2' : '#fef3c7',
                          color: binding.remainingSeconds < 60 ? '#dc2626' : '#d97706',
                        }}
                      >
                        {formatTime(binding.remainingSeconds)} 後過期
                      </span>
                    </div>
                  </div>

                  {/* Verify Button — two-step: tap to confirm, tap again to verify */}
                  {confirmTarget?.lineUserId === binding.lineUserId ? (
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => handleVerify(binding.lineUserId, binding.memberName, binding.phone)}
                        disabled={verifying === binding.lineUserId}
                        className="px-5 py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
                        style={{ background: 'var(--color-positive)', color: '#fff' }}
                      >
                        {verifying === binding.lineUserId ? '驗證中...' : '確定'}
                      </button>
                      <button
                        onClick={() => setConfirmTarget(null)}
                        className="px-3 py-1.5 rounded-lg text-xs"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmTarget({ lineUserId: binding.lineUserId, memberName: binding.memberName, phone: binding.phone })}
                      disabled={verifying === binding.lineUserId}
                      className="px-5 py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
                      style={{ background: 'var(--color-accent)', color: '#fff' }}
                    >
                      驗證
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Verification History */}
        {!loading && history.length > 0 && (
          <div
            className="rounded-2xl p-4 mt-6"
            style={{ background: 'var(--color-bg-card)' }}
          >
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>
              認證紀錄
            </h3>
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div>
                    <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {item.memberName}
                    </span>
                    <span className="text-sm ml-2" style={{ color: 'var(--color-text-muted)' }}>
                      {item.phone}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {item.verifiedBy || '門市人員'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {formatHistoryTime(item.verifiedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div
          className="rounded-2xl p-4 mt-4"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            使用說明
          </h3>
          <ol className="text-xs space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
            <li>1. 請客戶在 LINE 加入 Woody 並輸入「綁定 手機號碼」</li>
            <li>2. 待綁定請求會自動出現在此頁面</li>
            <li>3. 確認是本人後，點擊「驗證」按鈕完成綁定</li>
            <li>4. 客戶會收到 LINE 通知，綁定完成</li>
          </ol>
        </div>
      </div>

      <BottomNav active="dashboard" />
    </div>
  );
}
