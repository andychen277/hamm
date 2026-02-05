'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

interface PeriodData {
  start?: string;
  end?: string;
  date?: string;
  revenue: number;
}

interface StoreRevenueData {
  store: string;
  today: PeriodData;
  this_week: PeriodData;
  last_week: PeriodData;
  this_month: PeriodData;
  last_month: PeriodData;
  custom: PeriodData | null;
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

function formatDateRange(start?: string, end?: string, date?: string): string {
  if (date) return date;
  if (start && end) {
    if (start === end) return start;
    return `${start} ~ ${end}`;
  }
  return '';
}

export default function StoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const store = decodeURIComponent(params.store as string);
  const [data, setData] = useState<StoreRevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  // 自訂日期查詢
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customResult, setCustomResult] = useState<PeriodData | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/dashboard/stores/${encodeURIComponent(store)}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
          // 預設日期範圍設為本月
          if (json.data.this_month) {
            setStartDate(json.data.this_month.start);
            setEndDate(json.data.this_month.end);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [store]);

  const handleSearch = async () => {
    if (!startDate || !endDate) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/dashboard/stores/${encodeURIComponent(store)}?start_date=${startDate}&end_date=${endDate}`
      );
      const json = await res.json();
      if (json.success && json.data.custom) {
        setCustomResult(json.data.custom);
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  const storeColor = STORE_COLORS[store] || '#64748b';

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xl">←</button>
        <div className="flex items-center gap-2 flex-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: storeColor }}
          />
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {store}門市營收
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
            style={{ borderColor: storeColor, borderTopColor: 'transparent' }} />
        </div>
      ) : !data ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>找不到營收資料</p>
        </div>
      ) : (
        <div className="px-5">
          {/* 統計卡片 2x2 */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* 今日營收 */}
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
              <p className="text-[11px] mb-1" style={{ color: 'var(--color-text-muted)' }}>今日營收</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: storeColor }}>
                {fmt$(data.today.revenue)}
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {data.today.date}
              </p>
            </div>

            {/* 本週營收 */}
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
              <p className="text-[11px] mb-1" style={{ color: 'var(--color-text-muted)' }}>本週營收</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
                {fmt$(data.this_week.revenue)}
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {formatDateRange(data.this_week.start, data.this_week.end)}
              </p>
            </div>

            {/* 上週營收 */}
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
              <p className="text-[11px] mb-1" style={{ color: 'var(--color-text-muted)' }}>上週營收</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                {fmt$(data.last_week.revenue)}
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {formatDateRange(data.last_week.start, data.last_week.end)}
              </p>
            </div>

            {/* 本月營收 */}
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
              <p className="text-[11px] mb-1" style={{ color: 'var(--color-text-muted)' }}>本月營收</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>
                {fmt$(data.this_month.revenue)}
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {formatDateRange(data.this_month.start, data.this_month.end)}
              </p>
            </div>
          </div>

          {/* 上月營收 - 較大的卡片 */}
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
            <p className="text-[11px] mb-1" style={{ color: 'var(--color-text-muted)' }}>上月營收</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
              {fmt$(data.last_month.revenue)}
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {formatDateRange(data.last_month.start, data.last_month.end)}
            </p>
          </div>

          {/* 自訂日期查詢 */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              自訂日期查詢
            </h3>

            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="text-[10px] block mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  起始日期
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl text-sm outline-none"
                  style={{
                    background: 'var(--color-bg-card-alt)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-bg-card-alt)',
                  }}
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] block mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  結束日期
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl text-sm outline-none"
                  style={{
                    background: 'var(--color-bg-card-alt)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-bg-card-alt)',
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleSearch}
              disabled={searching || !startDate || !endDate}
              className="w-full h-10 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: storeColor, color: '#fff' }}
            >
              {searching ? '查詢中...' : '查詢'}
            </button>

            {/* 查詢結果 */}
            {customResult && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-bg-card-alt)' }}>
                <p className="text-[11px] mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  {formatDateRange(customResult.start, customResult.end)} 營收
                </p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: storeColor }}>
                  {fmt$(customResult.revenue)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav active="dashboard" />
    </div>
  );
}
