'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';

interface MemberStats {
  total: number;
  by_level: { level: string; count: number; total_spent: number }[];
  by_store: { store: string; count: number }[];
  recent_vip: { phone: string; name: string; total_spent: number; member_level: string }[];
}

const LEVEL_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  vip: { label: 'VIP', color: '#8B5CF6', emoji: '💎' },
  gold: { label: '金卡', color: '#F59E0B', emoji: '🥇' },
  silver: { label: '銀卡', color: '#6B7280', emoji: '🥈' },
  normal: { label: '一般', color: 'var(--color-bg-card-alt)', emoji: '👤' },
};

const STORE_COLORS: Record<string, string> = {
  '台南': '#FF6B6B',
  '高雄': '#4ECDC4',
  '台中': '#45B7D1',
  '台北': '#96CEB4',
  '美術': '#FFEAA7',
};

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

export default function MembersOverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<MemberStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/members')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setData(json.data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const maxLevelCount = data?.by_level.reduce((max, l) => Math.max(max, l.count), 0) || 1;
  const maxStoreCount = data?.by_store.reduce((max, s) => Math.max(max, s.count), 0) || 1;

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}>
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          👥 會員總覽
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-60">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : data && (
        <div className="px-5 space-y-4">
          {/* Total */}
          <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--color-bg-card)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>總會員數</p>
            <p className="text-4xl font-bold" style={{ color: 'var(--color-accent)' }}>
              {data.total.toLocaleString()}
            </p>
          </div>

          {/* By Level */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              會員等級分佈
            </h2>
            <div className="space-y-3">
              {data.by_level.map(item => {
                const levelInfo = LEVEL_LABELS[item.level] || LEVEL_LABELS.normal;
                return (
                  <div key={item.level}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span>{levelInfo.emoji}</span>
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {levelInfo.label}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                          {item.count.toLocaleString()}
                        </span>
                        <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
                          累計 {fmt$(item.total_spent)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(item.count / maxLevelCount) * 100}%`,
                          background: levelInfo.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By Store */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              各門市會員數
            </h2>
            <div className="space-y-3">
              {data.by_store.map(item => (
                <div key={item.store}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: STORE_COLORS[item.store] || '#888' }}
                      />
                      <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                        {item.store}
                      </span>
                    </div>
                    <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(item.count / maxStoreCount) * 100}%`,
                        background: STORE_COLORS[item.store] || '#888',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top VIP Members */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              💎 頂級 VIP 會員
            </h2>
            {data.recent_vip.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                尚無 VIP 會員
              </p>
            ) : (
              <div className="space-y-2">
                {data.recent_vip.map((member, idx) => (
                  <Link
                    key={member.phone}
                    href={`/reports/members/${encodeURIComponent(member.phone)}`}
                    className="flex items-center gap-3 p-2 rounded-lg active:opacity-70 transition-opacity"
                    style={{ background: 'var(--color-bg-card-alt)' }}
                  >
                    <span className="text-sm font-bold w-6 text-center" style={{ color: '#8B5CF6' }}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block" style={{ color: 'var(--color-text-primary)' }}>
                        {member.name || '未知'}
                      </span>
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
            )}
          </div>

          {/* Search Link */}
          <Link
            href="/reports/members"
            className="block rounded-2xl p-4 text-center active:opacity-70 transition-opacity"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            🔍 搜尋會員
          </Link>
        </div>
      )}

      <BottomNav active="dashboard" />
    </div>
  );
}
