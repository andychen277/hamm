'use client';

import { useState, useCallback } from 'react';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

interface InventoryItem {
  store: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  vendor_code: string;
  updated_at: string;
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

export default function InventoryReportPage() {
  const [search, setSearch] = useState('');
  const [store, setStore] = useState('all');
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({
        ...(search && { q: search }),
        ...(store !== 'all' && { store }),
      });
      const res = await fetch(`/api/reports/inventory?${params}`);
      const json = await res.json();
      if (json.success) setResults(json.data);
      else setResults([]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [search, store]);

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <Link href="/reports" className="text-xl">←</Link>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          📦 庫存查詢
        </h1>
      </div>

      {/* Search Form */}
      <div className="px-5 space-y-3">
        {/* Product search */}
        <input
          type="text"
          placeholder="搜尋商品名稱..."
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
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>無符合條件的商品</p>
          </div>
        ) : results.length > 0 && (
          <>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
              共 {results.length} 項商品
            </p>
            <div className="space-y-2">
              {results.map((item, i) => (
                <Link
                  key={`${item.store}-${item.product_id}-${i}`}
                  href={`/reports/products/${encodeURIComponent(item.product_id)}`}
                  className="block rounded-xl p-3"
                  style={{ background: 'var(--color-bg-card)' }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium flex-1 mr-2" style={{ color: 'var(--color-text-primary)' }}>
                      {item.product_name}
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: STORE_COLORS[item.store] || 'var(--color-accent)', color: '#fff' }}
                    >
                      {item.store}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                    <span>售價: {fmt$(item.price)}</span>
                    <span className="font-bold" style={{ color: 'var(--color-positive)' }}>
                      庫存: {item.quantity}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    <span>{item.product_id}</span>
                    {item.vendor_code && <span>廠商: {item.vendor_code}</span>}
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
