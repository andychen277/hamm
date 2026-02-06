'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';

interface StoreCount {
  store: string;
  count: number;
}

interface MonthlyTrend {
  month: string;
  total: number;
  stores: Record<string, number>;
}

interface RecentMember {
  phone: string;
  name: string;
  store: string;
  first_date: string;
  first_amount: number;
}

interface NewMembersData {
  this_month: {
    total: number;
    by_store: StoreCount[];
  };
  monthly_trend: MonthlyTrend[];
  recent_members: RecentMember[];
}

const STORE_COLORS: Record<string, string> = {
  '台南': '#FF6B6B',
  '高雄': '#4ECDC4',
  '台中': '#45B7D1',
  '台北': '#96CEB4',
  '美術': '#FFEAA7',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return (d.getMonth() + 1) + '/' + d.getDate();
}

function formatMonth(monthStr: string) {
  const parts = monthStr.split('-');
  return parts[0] + '年' + parseInt(parts[1]) + '月';
}

const STORES = ['全部', '台南', '高雄', '台中', '台北', '美術'];

export default function NewMembersPage() {
  const router = useRouter();
  const [data, setData] = useState<NewMembersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState('全部');

  useEffect(() => {
    fetch('/api/dashboard/new-members')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setData(json.data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Filter members by selected store
  const filteredMembers = data?.recent_members.filter(
    m => selectedStore === '全部' || m.store === selectedStore
  ) || [];

  // Get count for selected store
  const selectedCount = selectedStore === '全部'
    ? data?.this_month.total || 0
    : data?.this_month.by_store.find(s => s.store === selectedStore)?.count || 0;

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}>
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          👥 本月新會員
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-60">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : data && (
        <div className="px-5 space-y-4">
          {/* This Month Summary */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                本月各店新會員
              </h2>
              <span className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>
                {data.this_month.total} 人
              </span>
            </div>

            {data.this_month.by_store.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                本月尚無新會員
              </p>
            ) : (
              <div className="space-y-2">
                {data.this_month.by_store.map(item => (
                  <div key={item.store} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: STORE_COLORS[item.store] || '#888' }}
                    />
                    <span className="text-sm flex-1" style={{ color: 'var(--color-text-primary)' }}>
                      {item.store}
                    </span>
                    <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                      {item.count} 人
                    </span>
                    <div
                      className="h-2 rounded-full"
                      style={{
                        background: STORE_COLORS[item.store] || '#888',
                        width: Math.max(20, (item.count / data.this_month.total) * 100) + '%',
                        maxWidth: '40%',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly Trend */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              近三個月趨勢
            </h2>

            {data.monthly_trend.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                暫無資料
              </p>
            ) : (
              <div className="space-y-4">
                {data.monthly_trend.map(item => (
                  <div key={item.month} className="p-3 rounded-xl" style={{ background: 'var(--color-bg-card-alt)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {formatMonth(item.month)}
                      </span>
                      <span className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>
                        {item.total} 人
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(item.stores).sort((a, b) => b[1] - a[1]).map(([store, count]) => (
                        <span
                          key={store}
                          className="text-xs px-2 py-1 rounded-full"
                          style={{
                            background: STORE_COLORS[store] || '#888',
                            color: store === '美術' ? '#333' : '#fff',
                          }}
                        >
                          {store} {count}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Store Filter */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {STORES.map(store => (
              <button
                key={store}
                onClick={() => setSelectedStore(store)}
                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
                style={{
                  background: selectedStore === store
                    ? (store === '全部' ? 'var(--color-accent)' : STORE_COLORS[store] || '#888')
                    : 'var(--color-bg-card)',
                  color: selectedStore === store
                    ? (store === '美術' ? '#333' : '#fff')
                    : 'var(--color-text-secondary)',
                }}
              >
                {store}
                {store !== '全部' && data?.this_month.by_store.find(s => s.store === store) && (
                  <span className="ml-1 opacity-80">
                    {data.this_month.by_store.find(s => s.store === store)?.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Recent Members */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {selectedStore === '全部' ? '本月新會員名單' : `${selectedStore}店新會員`}
              </h2>
              <span className="text-sm font-medium" style={{ color: 'var(--color-accent)' }}>
                {selectedCount} 人
              </span>
            </div>

            {filteredMembers.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                {selectedStore === '全部' ? '本月尚無新會員' : `${selectedStore}店本月尚無新會員`}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredMembers.map((member, idx) => (
                  <Link
                    key={member.phone + '-' + idx}
                    href={`/reports/members/${encodeURIComponent(member.phone)}`}
                    className="flex items-center gap-3 p-2 rounded-lg active:opacity-70 transition-opacity"
                    style={{ background: 'var(--color-bg-card-alt)' }}
                  >
                    <div
                      className="w-2 h-8 rounded-full flex-shrink-0"
                      style={{ background: STORE_COLORS[member.store] || '#888' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {member.name || '未知'}
                        </span>
                        {selectedStore === '全部' && (
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {member.store}
                          </span>
                        )}
                      </div>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {formatDate(member.first_date)} 首購 ${member.first_amount.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>›</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav active="dashboard" />
    </div>
  );
}
