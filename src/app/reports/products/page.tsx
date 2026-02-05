'use client';

import { useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

interface ProductSale {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_revenue: number;
  avg_price: number;
  stores: string;
}

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Callback 模式參數
  const isCallback = searchParams.get('callback') === 'true';
  const callbackType = searchParams.get('callback_type') || 'product';
  const returnUrl = searchParams.get('return_url') || '/todo/create';

  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [store, setStore] = useState('all');
  const [results, setResults] = useState<ProductSale[]>([]);
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
      const res = await fetch(`/api/reports/products?${params}`);
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

  // Callback 模式：選擇商品
  const handleSelect = (p: ProductSale) => {
    const data = {
      type: callbackType,
      product_id: p.product_id,
      product_name: p.product_name,
      price: p.avg_price,
    };
    sessionStorage.setItem('callback_data', JSON.stringify(data));
    router.push(`${returnUrl}?callback_success=true`);
  };

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          🛒 商品銷售查詢 {isCallback && <span className="text-sm font-normal">(選擇商品)</span>}
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
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>無符合條件的商品</p>
          </div>
        ) : results.length > 0 && (
          <>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
              共 {results.length} 項商品
            </p>
            <div className="space-y-2">
              {results.map((p, i) => (
                <div
                  key={p.product_id || i}
                  className="rounded-xl p-3"
                  style={{ background: 'var(--color-bg-card)' }}
                >
                  {isCallback ? (
                    <>
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium flex-1 mr-2" style={{ color: 'var(--color-text-primary)' }}>
                          {p.product_name}
                        </span>
                        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
                          {fmt$(p.total_revenue)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <span>數量: {p.total_quantity}</span>
                        <span>均價: {fmt$(p.avg_price)}</span>
                      </div>
                      {p.stores && (
                        <div className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                          門市: {p.stores}
                        </div>
                      )}
                      <button
                        onClick={() => handleSelect(p)}
                        className="w-full mt-3 py-2 rounded-lg text-sm font-medium transition-opacity active:opacity-70"
                        style={{ background: 'var(--color-positive)', color: '#fff' }}
                      >
                        選擇此商品
                      </button>
                    </>
                  ) : (
                    <Link
                      href={`/reports/products/${encodeURIComponent(p.product_id)}`}
                      className="block"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium flex-1 mr-2" style={{ color: 'var(--color-text-primary)' }}>
                          {p.product_name}
                        </span>
                        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
                          {fmt$(p.total_revenue)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <span>數量: {p.total_quantity}</span>
                        <span>均價: {fmt$(p.avg_price)}</span>
                      </div>
                      {p.stores && (
                        <div className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                          門市: {p.stores}
                        </div>
                      )}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav active="reports" />
    </div>
  );
}

export default function ProductsReportPage() {
  return (
    <Suspense fallback={
      <div className="pb-20 min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
          style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}
