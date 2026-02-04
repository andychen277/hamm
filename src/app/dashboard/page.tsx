'use client';

import { useEffect, useState, useCallback } from 'react';
import BottomNav from '@/components/BottomNav';

interface KpiItem {
  value: number;
  change: number | null;
  label: string;
  compare: string;
}

interface KpiData {
  today_revenue: KpiItem;
  month_revenue: KpiItem;
  total_members: KpiItem;
  new_members: KpiItem;
  line_bindind_rate: KpiItem;
  avg_order_value: KpiItem;
}

interface StoreData {
  name: string;
  store: string;
  revenue: number;
  orders: number;
  color: string;
}

interface StatusData {
  active_repairs: number;
  pending_orders: number;
  watchlist_pending: number;
}

function formatNumber(n: number, isPercent = false): string {
  if (isPercent) return n.toFixed(1) + '%';
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

function KpiCard({ item }: { item: KpiItem }) {
  const isPercent = item.label.includes('率');
  return (
    <div className="min-w-[160px] rounded-2xl p-4 flex-shrink-0"
      style={{ background: 'var(--color-bg-card)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{item.label}</p>
      <p className="text-[28px] font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
        {isPercent ? item.value.toFixed(1) + '%' : formatNumber(item.value)}
      </p>
      <div className="flex items-center gap-1 mt-1">
        {item.change !== null && (
          <span className="text-xs font-medium" style={{
            color: item.change >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'
          }}>
            {item.change >= 0 ? '↑' : '↓'} {Math.abs(item.change).toFixed(1)}%
          </span>
        )}
        {item.compare && (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.compare}</span>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, storesRes, statusRes] = await Promise.all([
        fetch('/api/dashboard/kpi'),
        fetch('/api/dashboard/stores'),
        fetch('/api/dashboard/status'),
      ]);
      const [kpiData, storesData, statusData] = await Promise.all([
        kpiRes.json(),
        storesRes.json(),
        statusRes.json(),
      ]);

      if (kpiData.success) setKpi(kpiData.data);
      if (storesData.success) setStores(storesData.data);
      if (statusData.success) setStatus(statusData.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxRevenue = stores.length > 0 ? Math.max(...stores.map(s => s.revenue)) : 1;

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          🐷 總覽
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-60">
          <div className="w-8 h-8 border-[3px] rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          {/* KPI Cards - horizontal scroll */}
          {kpi && (
            <div className="flex gap-3 px-5 overflow-x-auto hide-scrollbar pb-2">
              {Object.values(kpi).map((item, i) => (
                <KpiCard key={i} item={item} />
              ))}
            </div>
          )}

          {/* Store Revenue Ranking */}
          <div className="mx-5 mt-6 rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <h2 className="text-[15px] font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              本月門市營收
            </h2>
            <div className="space-y-3">
              {stores.map((store) => (
                <div key={store.store}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {store.name}
                    </span>
                    <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                      {formatNumber(store.revenue)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(store.revenue / maxRevenue) * 100}%`,
                        background: store.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status Row */}
          {status && (
            <div className="flex gap-3 mx-5 mt-4">
              <div className="flex-1 rounded-2xl p-3 text-center" style={{ background: 'var(--color-bg-card)' }}>
                <p className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--color-warning)' }}>
                  {status.active_repairs}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>維修中</p>
              </div>
              <div className="flex-1 rounded-2xl p-3 text-center" style={{ background: 'var(--color-bg-card)' }}>
                <p className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>
                  {status.pending_orders}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>待到貨</p>
              </div>
              <div className="flex-1 rounded-2xl p-3 text-center" style={{ background: 'var(--color-bg-card)' }}>
                <p className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
                  {status.watchlist_pending}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>關注待通知</p>
              </div>
            </div>
          )}
        </>
      )}

      <BottomNav active="dashboard" />
    </div>
  );
}
