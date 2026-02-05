'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

interface Product {
  product_id: string;
  product_name: string;
  vendor_code: string;
  vendor_name: string;
  price: number;
  cost: number;
}

interface YearlySummary {
  year: number;
  order_count: number;
  total_qty: number;
  total_revenue: number;
  purchase_qty: number;
  purchase_cost: number;
}

interface MonthlyDetail {
  month: string;
  year: number;
  month_num: number;
  order_count: number;
  total_qty: number;
  total_revenue: number;
}

interface InventoryByStore {
  store: string;
  qty: number;
  cost: number;
  value: number;
}

interface HistoryData {
  products: Product[];
  yearly_summary: YearlySummary[];
  monthly_detail: MonthlyDetail[];
  current_inventory: InventoryByStore[];
  inventory_totals: {
    qty: number;
    cost: number;
    value: number;
  };
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

export default function HistorySalesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [vendor, setVendor] = useState('');
  const [store, setStore] = useState('all');
  const [years, setYears] = useState('3');
  const [months, setMonths] = useState('12');
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!search && !vendor) {
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams({
        ...(search && { q: search }),
        ...(vendor && { vendor }),
        ...(store !== 'all' && { store }),
        years,
        months,
      });

      const res = await fetch(`/api/reports/history?${params}`);
      const json = await res.json();

      if (json.success) {
        setData(json.data);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [search, vendor, store, years, months]);

  const grandTotalRevenue = data?.yearly_summary.reduce((sum, y) => sum + y.total_revenue, 0) || 0;
  const grandTotalQty = data?.yearly_summary.reduce((sum, y) => sum + y.total_qty, 0) || 0;

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          📈 歷史銷售分析
        </h1>
      </div>

      {/* Search Form */}
      <div className="px-5 space-y-3">
        {/* Product search */}
        <input
          type="text"
          placeholder="搜尋商品名稱或編號..."
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

        {/* Vendor search */}
        <input
          type="text"
          placeholder="廠商代碼（選填）..."
          value={vendor}
          onChange={e => setVendor(e.target.value)}
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

        {/* Time range filters */}
        <div className="flex gap-2">
          <select
            value={years}
            onChange={e => setYears(e.target.value)}
            className="flex-1 h-10 px-3 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-bg-card-alt)',
            }}
          >
            <option value="1">年報：近 1 年</option>
            <option value="2">年報：近 2 年</option>
            <option value="3">年報：近 3 年</option>
            <option value="5">年報：近 5 年</option>
            <option value="10">年報：近 10 年</option>
          </select>

          <select
            value={months}
            onChange={e => setMonths(e.target.value)}
            className="flex-1 h-10 px-3 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-bg-card-alt)',
            }}
          >
            <option value="3">月報：近 3 月</option>
            <option value="6">月報：近 6 月</option>
            <option value="12">月報：近 12 月</option>
            <option value="24">月報：近 24 月</option>
            <option value="36">月報：近 36 月</option>
          </select>
        </div>

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={loading || (!search && !vendor)}
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
            <div
              className="w-7 h-7 border-[3px] rounded-full animate-spin"
              style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : searched && (!data || data.products.length === 0) ? (
          <div className="text-center py-10">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>無符合條件的商品</p>
          </div>
        ) : data && data.products.length > 0 && (
          <>
            {/* Matched Products */}
            <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
              <h3 className="text-[13px] font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                🔍 符合商品 ({data.products.length} 項)
              </h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {data.products.slice(0, 10).map((p, i) => (
                  <div key={i} className="text-xs flex justify-between" style={{ color: 'var(--color-text-secondary)' }}>
                    <span className="truncate flex-1 mr-2">{p.product_name}</span>
                    <span className="flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                      {p.vendor_code || '-'}
                    </span>
                  </div>
                ))}
                {data.products.length > 10 && (
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    ...還有 {data.products.length - 10} 項
                  </p>
                )}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
                    {fmt$(grandTotalRevenue)}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>總銷售額</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>
                    {grandTotalQty.toLocaleString()}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>總銷量</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                    {data.inventory_totals.qty.toLocaleString()}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>現有庫存</p>
                </div>
              </div>
            </div>

            {/* Yearly Summary Table */}
            {data.yearly_summary.length > 0 && (
              <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
                <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  📅 年度銷售
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: 'var(--color-text-muted)' }}>
                        <th className="text-left py-2 pr-2">年度</th>
                        <th className="text-right py-2 px-2">訂單</th>
                        <th className="text-right py-2 px-2">數量</th>
                        <th className="text-right py-2 pl-2">銷售額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.yearly_summary.map((row, i) => (
                        <tr
                          key={row.year}
                          className="border-t"
                          style={{ borderColor: 'var(--color-bg-card-alt)' }}
                        >
                          <td className="py-2 pr-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            {row.year}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                            {row.order_count}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                            {row.total_qty}
                          </td>
                          <td className="py-2 pl-2 text-right tabular-nums font-medium" style={{ color: 'var(--color-positive)' }}>
                            {fmt$(row.total_revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Monthly Detail Table */}
            {data.monthly_detail.length > 0 && (
              <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
                <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  📊 月度明細（近 {months} 個月）
                </h3>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0" style={{ background: 'var(--color-bg-card)' }}>
                      <tr style={{ color: 'var(--color-text-muted)' }}>
                        <th className="text-left py-2 pr-2">月份</th>
                        <th className="text-right py-2 px-2">訂單</th>
                        <th className="text-right py-2 px-2">數量</th>
                        <th className="text-right py-2 pl-2">銷售額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.monthly_detail.map((row, i) => (
                        <tr
                          key={row.month}
                          className="border-t"
                          style={{ borderColor: 'var(--color-bg-card-alt)' }}
                        >
                          <td className="py-2 pr-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            {row.month}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                            {row.order_count}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                            {row.total_qty}
                          </td>
                          <td className="py-2 pl-2 text-right tabular-nums font-medium" style={{ color: 'var(--color-positive)' }}>
                            {fmt$(row.total_revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Current Inventory by Store */}
            {data.current_inventory.length > 0 && (
              <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
                <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  📦 各店庫存
                </h3>
                <div className="space-y-2">
                  {data.current_inventory.map((inv, i) => (
                    <div key={inv.store} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: STORE_COLORS[inv.store] || '#64748b' }}
                        />
                        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {inv.store}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                          {inv.qty} 件
                        </span>
                        <span className="text-[11px] ml-2" style={{ color: 'var(--color-text-muted)' }}>
                          成本 {fmt$(inv.cost)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav active="reports" />
    </div>
  );
}
