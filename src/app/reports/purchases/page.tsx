'use client';

import { useState, useCallback } from 'react';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

interface PurchaseItem {
  product_id: string;
  product_name: string;
  supplier: string;
  unit_price: number;
  unit_cost: number;
  total_cost: number;
  total_qty: number;
  stock_tainan: number;
  stock_chongming: number;
  stock_kaohsiung: number;
  stock_meishu: number;
  stock_taichung: number;
  stock_taipei: number;
  total_sales: number;
  total_sales_qty: number;
  sales_ratio: number;
  period_start: string;
  period_end: string;
}

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

export default function PurchasesReportPage() {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [store, setStore] = useState('all');
  const [results, setResults] = useState<PurchaseItem[]>([]);
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
      });
      const res = await fetch(`/api/reports/purchases?${params}`);
      const json = await res.json();
      if (json.success) setResults(json.data);
      else setResults([]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [search, startDate, endDate, store]);

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
          📥 進貨查詢
        </h1>
      </div>

      {/* Search Form */}
      <div className="px-5 space-y-3">
        {/* Product/Supplier search */}
        <input
          type="text"
          placeholder="搜尋商品名稱或供應商..."
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

        {/* Store filter */}
        <select
          value={store}
          onChange={e => setStore(e.target.value)}
          className="w-full h-10 px-3 rounded-xl text-sm outline-none"
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
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>無符合條件的進貨資料</p>
          </div>
        ) : results.length > 0 && (
          <>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
              共 {results.length} 筆進貨
            </p>
            <div className="space-y-2">
              {results.map((item, i) => (
                <Link
                  key={`${item.product_id}-${i}`}
                  href={`/reports/products/${encodeURIComponent(item.product_id)}`}
                  className="block rounded-xl p-3"
                  style={{ background: 'var(--color-bg-card)' }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium flex-1 mr-2" style={{ color: 'var(--color-text-primary)' }}>
                      {item.product_name}
                    </span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
                      {fmt$(item.total_cost)}
                    </span>
                  </div>
                  <div className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    供應商: {item.supplier || '-'}
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <span>進貨量: {item.total_qty}</span>
                    <span>單位成本: {fmt$(item.unit_cost)}</span>
                  </div>
                  {/* Stock by store */}
                  <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
                    {item.stock_tainan > 0 && (
                      <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-store-tainan)', color: '#fff' }}>
                        台南 {item.stock_tainan}
                      </span>
                    )}
                    {item.stock_kaohsiung > 0 && (
                      <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-store-kaohsiung)', color: '#000' }}>
                        高雄 {item.stock_kaohsiung}
                      </span>
                    )}
                    {item.stock_taichung > 0 && (
                      <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-store-taichung)', color: '#fff' }}>
                        台中 {item.stock_taichung}
                      </span>
                    )}
                    {item.stock_taipei > 0 && (
                      <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-store-taipei)', color: '#fff' }}>
                        台北 {item.stock_taipei}
                      </span>
                    )}
                    {item.stock_meishu > 0 && (
                      <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-store-meishu)', color: '#fff' }}>
                        美術 {item.stock_meishu}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-[11px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
                    <span>{item.product_id}</span>
                    <span>進銷比: {item.sales_ratio.toFixed(2)}</span>
                  </div>
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
