'use client';

import { useState, useCallback } from 'react';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

interface RepairItem {
  repair_id: string;
  store: string;
  open_date: string;
  customer_name: string;
  customer_phone: string;
  repair_desc: string;
  deposit: number;
  store_note: string;
  vendor_quote: number;
  vendor_note: string;
  assigned_to: string;
  status: string;
  updated_at: string;
}

const STORE_COLORS: Record<string, string> = {
  '台南': 'var(--color-store-tainan)',
  '高雄': 'var(--color-store-kaohsiung)',
  '台中': 'var(--color-store-taichung)',
  '台北': 'var(--color-store-taipei)',
  '美術': 'var(--color-store-meishu)',
};

const STATUS_COLORS: Record<string, string> = {
  '開單': 'var(--color-warning)',
  '維修中': 'var(--color-accent)',
  '已完成': 'var(--color-positive)',
  '已完修': 'var(--color-positive)',
  '待取件': '#9B5DE5',
  '已取車': 'var(--color-text-muted)',
  '已取消': 'var(--color-negative)',
};

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

export default function RepairsReportPage() {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [store, setStore] = useState('all');
  const [status, setStatus] = useState('all');
  const [results, setResults] = useState<RepairItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
        ...(search && { q: search }),
        ...(store !== 'all' && { store }),
        ...(status !== 'all' && { status }),
      });
      const res = await fetch(`/api/reports/repairs?${params}`);
      const json = await res.json();
      if (json.success) setResults(json.data);
      else setResults([]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [search, startDate, endDate, store, status]);

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <Link href="/reports" className="text-xl">←</Link>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          🔧 維修查詢
        </h1>
      </div>

      {/* Search Form */}
      <div className="px-5 space-y-3">
        {/* Customer search */}
        <input
          type="text"
          placeholder="搜尋客戶姓名或電話..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="w-full h-11 px-4 rounded-xl text-sm outline-none"
          style={{
            background: 'var(--color-bg-card)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-bg-card-alt)',
          }}
        />

        {/* Date range */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>開始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-bg-card-alt)',
              }}
            />
          </div>
          <div className="flex-1">
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>結束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-bg-card-alt)',
              }}
            />
          </div>
        </div>

        {/* Quick date buttons */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: '今天', days: 0 },
            { label: '7天', days: 7 },
            { label: '30天', days: 30 },
            { label: '90天', days: 90 },
          ].map(({ label, days }) => (
            <button
              key={label}
              onClick={() => setQuickRange(days)}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Store & Status filters */}
        <div className="flex gap-2">
          <select
            value={store}
            onChange={e => setStore(e.target.value)}
            className="flex-1 h-10 px-3 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-bg-card-alt)',
            }}
          >
            <option value="all">全部門市</option>
            <option value="台南">台南</option>
            <option value="高雄">高雄</option>
            <option value="台中">台中</option>
            <option value="台北">台北</option>
            <option value="美術">美術</option>
          </select>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="flex-1 h-10 px-3 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-bg-card-alt)',
            }}
          >
            <option value="all">全部狀態</option>
            <option value="開單">開單</option>
            <option value="維修中">維修中</option>
            <option value="已完修">已完修</option>
            <option value="待取件">待取件</option>
            <option value="已取車">已取車</option>
          </select>
        </div>

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full h-11 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          {loading ? '查詢中...' : '查詢'}
        </button>
      </div>

      {/* Results */}
      <div className="px-5 mt-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
              style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : searched && results.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>無符合條件的維修記錄</p>
          </div>
        ) : results.length > 0 && (
          <>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
              共 {results.length} 筆維修
            </p>
            <div className="space-y-2">
              {results.map((item, i) => (
                <Link
                  key={`${item.repair_id}-${i}`}
                  href={`/reports/repairs/${encodeURIComponent(item.repair_id)}`}
                  className="block rounded-xl p-3"
                  style={{ background: 'var(--color-bg-card)' }}
                >
                  {/* Header: ID, Store, Status */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-muted)' }}>
                      {item.repair_id.slice(-8)}
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: STORE_COLORS[item.store] || 'var(--color-accent)', color: '#fff' }}
                    >
                      {item.store}
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: STATUS_COLORS[item.status] || 'var(--color-text-muted)', color: '#fff' }}
                    >
                      {item.status}
                    </span>
                    <span className="text-[11px] ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                      {item.open_date}
                    </span>
                  </div>

                  {/* Customer info */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {item.customer_name || '(無姓名)'}
                      </span>
                      {item.customer_phone && (
                        <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
                          {item.customer_phone}
                        </span>
                      )}
                    </div>
                    {item.deposit > 0 && (
                      <span className="text-xs font-medium" style={{ color: 'var(--color-positive)' }}>
                        暫付 {fmt$(item.deposit)}
                      </span>
                    )}
                  </div>

                  {/* Repair description */}
                  {item.repair_desc && (
                    <p className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                      {item.repair_desc}
                    </p>
                  )}

                  {/* Assigned to */}
                  {item.assigned_to && (
                    <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                      負責: {item.assigned_to}
                    </div>
                  )}

                  {/* Vendor quote */}
                  {item.vendor_quote > 0 && (
                    <div className="text-[11px] mt-1" style={{ color: 'var(--color-warning)' }}>
                      廠商報價: {fmt$(item.vendor_quote)}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav active="reports" />
    </div>
  );
}
