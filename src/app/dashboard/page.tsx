'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import TrendChart from '@/components/TrendChart';
import { useCountUp } from '@/hooks/useCountUp';

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

function formatNumber(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

function AnimatedKpiCard({ item }: { item: KpiItem }) {
  const isPercent = item.label.includes('率');
  const isCount = item.label.includes('會員');
  const animated = useCountUp(item.value);

  const displayValue = isPercent
    ? animated.toFixed(1) + '%'
    : isCount
      ? Math.round(animated).toLocaleString()
      : formatNumber(Math.round(animated));

  return (
    <div className="min-w-[160px] rounded-2xl p-4 flex-shrink-0"
      style={{ background: 'var(--color-bg-card)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{item.label}</p>
      <p className="text-[28px] font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
        {displayValue}
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
  const [refreshing, setRefreshing] = useState(false);

  // Pull-to-refresh state
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const isPulling = useRef(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
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
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current;
    if (el && el.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.4, 80));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 50 && !refreshing) {
      fetchData(true);
    }
    setPullDistance(0);
    isPulling.current = false;
  }, [pullDistance, refreshing, fetchData]);

  const maxRevenue = stores.length > 0 ? Math.max(...stores.map(s => s.revenue)) : 1;

  return (
    <div
      ref={containerRef}
      className="pb-20 min-h-screen overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-300"
        style={{ height: pullDistance > 0 ? pullDistance : refreshing ? 48 : 0 }}
      >
        <div
          className="w-6 h-6 border-2 rounded-full"
          style={{
            borderColor: 'var(--color-accent)',
            borderTopColor: 'transparent',
            animation: refreshing || pullDistance > 50 ? 'spin 0.8s linear infinite' : 'none',
            opacity: pullDistance > 10 || refreshing ? 1 : 0,
            transform: `rotate(${pullDistance * 3}deg)`,
          }}
        />
      </div>

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
                <AnimatedKpiCard key={i} item={item} />
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
                <Link
                  key={store.store}
                  href={`/dashboard/stores/${encodeURIComponent(store.store)}`}
                  className="block active:opacity-70 transition-opacity"
                >
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
                </Link>
              ))}
            </div>
          </div>

          {/* Revenue Trend Chart */}
          <TrendChart />

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
