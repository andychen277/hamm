'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';

interface ProductSales {
  product_id: string;
  product_name: string;
  quantity: number;
  revenue: number;
  transaction_count: number;
}

interface PeriodSalesData {
  store: string;
  period: string;
  label: string;
  date_range: { start: string; end: string };
  summary: {
    total_revenue: number;
    total_qty: number;
    product_count: number;
  };
  products: ProductSales[];
}

const STORE_COLORS: Record<string, string> = {
  '台南': 'var(--color-store-tainan)',
  '高雄': 'var(--color-store-kaohsiung)',
  '台中': 'var(--color-store-taichung)',
  '台北': 'var(--color-store-taipei)',
  '美術': 'var(--color-store-meishu)',
};

const PERIOD_LABELS: Record<string, string> = {
  'today': '今日',
  'this-week': '本週',
  'last-week': '上週',
  'this-month': '本月',
  'last-month': '上月',
  'custom': '自訂',
};

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

export default function PeriodSalesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = decodeURIComponent(params.store as string);
  const period = params.period as string;
  const customStart = searchParams.get('start') || '';
  const customEnd = searchParams.get('end') || '';

  const [data, setData] = useState<PeriodSalesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        let url = `/api/dashboard/stores/${encodeURIComponent(store)}/${period}`;
        if (period === 'custom' && customStart && customEnd) {
          url += `?start=${customStart}&end=${customEnd}`;
        }
        const res = await fetch(url);
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [store, period, customStart, customEnd]);

  const storeColor = STORE_COLORS[store] || '#64748b';
  const periodLabel = PERIOD_LABELS[period] || period;

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
            {store}門市 - {periodLabel}銷售
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
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>找不到銷售資料</p>
        </div>
      ) : (
        <div className="px-5">
          {/* Summary */}
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
              {data.date_range.start === data.date_range.end
                ? data.date_range.start
                : `${data.date_range.start} ~ ${data.date_range.end}`}
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold tabular-nums" style={{ color: storeColor }}>
                  {fmt$(data.summary.total_revenue)}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>總營收</p>
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>
                  {data.summary.total_qty}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>總數量</p>
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                  {data.summary.product_count}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>商品種類</p>
              </div>
            </div>
          </div>

          {/* Product List */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              銷售商品明細
            </h3>

            {data.products.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                該時段無銷售資料
              </p>
            ) : (
              <div className="space-y-2">
                {data.products.map((product, i) => (
                  <Link
                    key={`${product.product_id}-${i}`}
                    href={`/reports/products/${encodeURIComponent(product.product_id)}`}
                    className="block rounded-xl p-3 active:opacity-70 transition-opacity"
                    style={{ background: 'var(--color-bg-card-alt)' }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span
                        className="text-sm flex-1 mr-2 line-clamp-2"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {product.product_name}
                      </span>
                      <span
                        className="text-sm font-bold tabular-nums whitespace-nowrap"
                        style={{ color: 'var(--color-positive)' }}
                      >
                        {fmt$(product.revenue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                        {product.product_id}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {product.quantity}件 · {product.transaction_count}筆
                      </span>
                    </div>
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
