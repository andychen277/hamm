'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';

interface StoreRevenue {
  store: string;
  revenue: number;
}

interface RevenueData {
  period: string;
  label: string;
  start: string;
  end: string;
  total: number;
  stores: StoreRevenue[];
}

const STORE_COLORS: Record<string, string> = {
  '台南': 'var(--color-store-tainan)',
  '高雄': 'var(--color-store-kaohsiung)',
  '台中': 'var(--color-store-taichung)',
  '台北': 'var(--color-store-taipei)',
  '美術': 'var(--color-store-meishu)',
};

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

export default function RevenuePeriodPage() {
  const params = useParams();
  const router = useRouter();
  const period = params.period as string;
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/dashboard/revenue/${period}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [period]);

  const maxRevenue = data?.stores.length ? Math.max(...data.stores.map(s => s.revenue)) : 1;

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {data?.label || '營收'}
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : !data ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>找不到營收資料</p>
        </div>
      ) : (
        <div className="px-5">
          {/* Total Revenue Card */}
          <div className="rounded-2xl p-5 mb-4" style={{ background: 'var(--color-bg-card)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {data.start === data.end ? data.start : `${data.start} ~ ${data.end}`}
            </p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>
              {fmt$(data.total)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              全門市合計
            </p>
          </div>

          {/* Store Breakdown */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <h2 className="text-[15px] font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              各門市營收
            </h2>
            <div className="space-y-3">
              {data.stores.map((store) => {
                const color = STORE_COLORS[store.store] || '#64748b';
                return (
                  <Link
                    key={store.store}
                    href={`/dashboard/stores/${encodeURIComponent(store.store)}/${period}`}
                    className="block active:opacity-70 transition-opacity"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: color }}
                        />
                        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {store.store}
                        </span>
                      </div>
                      <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                        {fmt$(store.revenue)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(store.revenue / maxRevenue) * 100}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <BottomNav active="dashboard" />
    </div>
  );
}
