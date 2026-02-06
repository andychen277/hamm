'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';

interface BoundMember {
  phone: string;
  name: string;
  member_level: string;
  total_spent: number;
  bound_at: string | null;
}

interface LineBindingData {
  total_members: number;
  bound_count: number;
  unbound_count: number;
  binding_rate: number;
  recent_bound: BoundMember[];
  top_unbound: BoundMember[];
}

const LEVEL_COLORS: Record<string, string> = {
  vip: '#8B5CF6',
  gold: '#F59E0B',
  silver: '#6B7280',
  normal: 'var(--color-bg-card-alt)',
};

const LEVEL_LABELS: Record<string, string> = {
  vip: 'VIP',
  gold: '金卡',
  silver: '銀卡',
  normal: '一般',
};

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

export default function LineBindingPage() {
  const router = useRouter();
  const [data, setData] = useState<LineBindingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bound' | 'unbound'>('unbound');

  useEffect(() => {
    fetch('/api/dashboard/line-binding')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setData(json.data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}>
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          LINE 綁定狀態
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-60">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : data && (
        <div className="px-5 space-y-4">
          {/* Summary */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <div className="text-center mb-4">
              <p className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>LINE 綁定率</p>
              <p className="text-4xl font-bold" style={{ color: 'var(--color-accent)' }}>
                {data.binding_rate.toFixed(1)}%
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {data.bound_count.toLocaleString()} / {data.total_members.toLocaleString()} 位會員
              </p>
            </div>

            {/* Progress Bar */}
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${data.binding_rate}%`,
                  background: 'var(--color-positive)',
                }}
              />
            </div>

            <div className="flex justify-between mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span>已綁定 {data.bound_count.toLocaleString()}</span>
              <span>未綁定 {data.unbound_count.toLocaleString()}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('unbound')}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: activeTab === 'unbound' ? 'var(--color-warning)' : 'var(--color-bg-card)',
                color: activeTab === 'unbound' ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              待綁定高價值會員
            </button>
            <button
              onClick={() => setActiveTab('bound')}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: activeTab === 'bound' ? 'var(--color-positive)' : 'var(--color-bg-card)',
                color: activeTab === 'bound' ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              最近綁定
            </button>
          </div>

          {/* Member List */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              {activeTab === 'unbound' ? '消費金額最高的未綁定會員' : '最近綁定的會員'}
            </h2>

            {activeTab === 'unbound' ? (
              data.top_unbound.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                  所有會員都已綁定 LINE
                </p>
              ) : (
                <div className="space-y-2">
                  {data.top_unbound.map((member, idx) => (
                    <Link
                      key={member.phone}
                      href={`/reports/members/${encodeURIComponent(member.phone)}`}
                      className="flex items-center gap-3 p-2 rounded-lg active:opacity-70 transition-opacity"
                      style={{ background: 'var(--color-bg-card-alt)' }}
                    >
                      <span className="text-sm font-medium w-6 text-center" style={{ color: 'var(--color-warning)' }}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {member.name || '未知'}
                          </span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: LEVEL_COLORS[member.member_level], color: '#fff' }}
                          >
                            {LEVEL_LABELS[member.member_level]}
                          </span>
                        </div>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {member.phone}
                        </span>
                      </div>
                      <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--color-positive)' }}>
                        {fmt$(member.total_spent)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>›</span>
                    </Link>
                  ))}
                </div>
              )
            ) : (
              data.recent_bound.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                  尚無綁定紀錄
                </p>
              ) : (
                <div className="space-y-2">
                  {data.recent_bound.map((member) => (
                    <Link
                      key={member.phone}
                      href={`/reports/members/${encodeURIComponent(member.phone)}`}
                      className="flex items-center gap-3 p-2 rounded-lg active:opacity-70 transition-opacity"
                      style={{ background: 'var(--color-bg-card-alt)' }}
                    >
                      <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: 'var(--color-positive)' }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {member.name || '未知'}
                          </span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: LEVEL_COLORS[member.member_level], color: '#fff' }}
                          >
                            {LEVEL_LABELS[member.member_level]}
                          </span>
                        </div>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {member.bound_at ? new Date(member.bound_at).toLocaleDateString('zh-TW') : ''}
                        </span>
                      </div>
                      <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--color-positive)' }}>
                        {fmt$(member.total_spent)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>›</span>
                    </Link>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}

      <BottomNav active="dashboard" />
    </div>
  );
}
