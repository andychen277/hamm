'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

interface ProductDetail {
  product_id: string;
  product_name: string;
  inventory: {
    store: string;
    price: number;
    quantity: number;
    vendor_code: string;
  }[];
  sales_by_store: {
    store: string;
    total_qty: number;
    total_revenue: number;
    order_count: number;
    last_sale_date: string;
  }[];
  purchases: {
    supplier: string;
    unit_cost: number;
    purchase_qty: number;
    purchase_cost: number;
    period_start: string;
    period_end: string;
  }[];
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
      <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
      {children}
    </div>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = decodeURIComponent(params.id as string);
  const [data, setData] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/reports/products/${encodeURIComponent(productId)}`);
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [productId]);

  const totalStock = data?.inventory.reduce((sum, i) => sum + i.quantity, 0) || 0;

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-lg font-bold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          商品詳情
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : !data ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>找不到商品資料</p>
        </div>
      ) : (
        <div className="px-5">
          {/* Product Name */}
          <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
            <h2 className="text-base font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              {data.product_name}
            </h2>
            <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
              {data.product_id}
            </p>
          </div>

          {/* Inventory by Store - Clickable */}
          <Card title="📦 各門市庫存">
            {data.inventory.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>無庫存資料</p>
            ) : (
              <div className="space-y-2">
                {data.inventory.map(inv => (
                  <Link
                    key={inv.store}
                    href={`/reports/inventory?q=${encodeURIComponent(data.product_id)}&store=${encodeURIComponent(inv.store)}`}
                    className="flex items-center justify-between py-1 -mx-1 px-1 rounded-lg active:bg-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: STORE_COLORS[inv.store] || '#64748b' }} />
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{inv.store}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>{inv.quantity}</span>
                        <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>{fmt$(inv.price)}</span>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>›</span>
                    </div>
                  </Link>
                ))}
                <div className="border-t pt-2 mt-2" style={{ borderColor: 'var(--color-bg-card-alt)' }}>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--color-text-muted)' }}>總庫存</span>
                    <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{totalStock}</span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Sales by Store (last 90 days) - Clickable */}
          {data.sales_by_store.length > 0 && (
            <Card title="🏪 各門市銷售（近90天）">
              <div className="space-y-2">
                {data.sales_by_store.map(s => (
                  <Link
                    key={s.store}
                    href={`/reports/products/${encodeURIComponent(productId)}/store/${encodeURIComponent(s.store)}`}
                    className="flex items-center justify-between py-1 -mx-1 px-1 rounded-lg active:bg-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: STORE_COLORS[s.store] || '#64748b' }} />
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{s.store}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                          {fmt$(s.total_revenue)}
                        </span>
                        <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
                          {s.total_qty}件
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>›</span>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Purchase History - Clickable */}
          {data.purchases.length > 0 && (
            <Card title="📥 進貨記錄">
              <div className="space-y-3">
                {data.purchases.map((p, i) => (
                  <Link
                    key={i}
                    href={`/reports/purchases/supplier/${encodeURIComponent(p.supplier)}?product_id=${encodeURIComponent(data.product_id)}`}
                    className="block p-2.5 rounded-xl active:opacity-70 transition-opacity"
                    style={{ background: 'var(--color-bg-card-alt)' }}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {p.supplier}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
                          {fmt$(p.purchase_cost)}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>›</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      <span>
                        {p.period_start && p.period_end
                          ? `${new Date(p.period_start).toLocaleDateString('zh-TW')} ~ ${new Date(p.period_end).toLocaleDateString('zh-TW')}`
                          : '日期未知'}
                      </span>
                      <span>數量 {p.purchase_qty} · 單價 {fmt$(p.unit_cost)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <BottomNav active="reports" />
    </div>
  );
}
