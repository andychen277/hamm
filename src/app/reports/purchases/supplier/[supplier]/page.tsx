'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

interface Purchase {
  product_id: string;
  product_name: string;
  supplier: string;
  unit_cost: number;
  total_qty: number;
  total_cost: number;
  stock_tainan: number;
  stock_kaohsiung: number;
  stock_taichung: number;
  stock_taipei: number;
  stock_meishu: number;
  period_start: string;
  period_end: string;
}

interface StoreInventory {
  store: string;
  total_qty: number;
  total_value: number;
  products: number;
}

interface SupplierData {
  supplier: string;
  purchases: Purchase[];
  inventory_by_store: StoreInventory[];
  totals: {
    purchase_cost: number;
    purchase_qty: number;
    inventory_qty: number;
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
      <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
      {children}
    </div>
  );
}

export default function SupplierPurchasesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplierName = decodeURIComponent(params.supplier as string);
  const productId = searchParams.get('product_id') || '';

  const [data, setData] = useState<SupplierData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const url = `/api/reports/purchases/supplier/${encodeURIComponent(supplierName)}${productId ? `?product_id=${encodeURIComponent(productId)}` : ''}`;
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
  }, [supplierName, productId]);

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-lg font-bold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          供應商進貨詳情
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : !data ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>找不到供應商資料</p>
        </div>
      ) : (
        <div className="px-5">
          {/* Supplier Name */}
          <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
            <h2 className="text-base font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              🏭 {data.supplier}
            </h2>
            <div className="grid grid-cols-3 gap-3 text-center mt-3">
              <div>
                <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
                  {fmt$(data.totals.purchase_cost)}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>90天進貨額</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>
                  {data.totals.purchase_qty}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>進貨數量</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                  {data.totals.inventory_qty}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>現有庫存</p>
              </div>
            </div>
          </div>

          {/* Inventory by Store */}
          {data.inventory_by_store.length > 0 && (
            <Card title="📦 各店庫存">
              <div className="space-y-2">
                {data.inventory_by_store.map(inv => (
                  <div key={inv.store} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: STORE_COLORS[inv.store] || '#64748b' }} />
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{inv.store}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
                        {inv.total_qty} 件
                      </span>
                      <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
                        {inv.products} 品項
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recent Purchases (90 days) */}
          <Card title="📥 近90天進貨明細">
            {data.purchases.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>無進貨記錄</p>
            ) : (
              <div className="space-y-3">
                {data.purchases.map((p, i) => (
                  <Link
                    key={i}
                    href={`/reports/products/${encodeURIComponent(p.product_id)}`}
                    className="block p-2.5 rounded-xl active:opacity-70 transition-opacity"
                    style={{ background: 'var(--color-bg-card-alt)' }}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="text-sm font-medium flex-1 mr-2 truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {p.product_name}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
                          {fmt$(p.total_cost)}
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
                      <span>數量 {p.total_qty} · 單價 {fmt$(p.unit_cost)}</span>
                    </div>
                    {/* Show store stock for this purchase */}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {p.stock_tainan > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-store-tainan)', color: '#fff' }}>
                          台南 {p.stock_tainan}
                        </span>
                      )}
                      {p.stock_kaohsiung > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-store-kaohsiung)', color: '#fff' }}>
                          高雄 {p.stock_kaohsiung}
                        </span>
                      )}
                      {p.stock_taichung > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-store-taichung)', color: '#fff' }}>
                          台中 {p.stock_taichung}
                        </span>
                      )}
                      {p.stock_taipei > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-store-taipei)', color: '#fff' }}>
                          台北 {p.stock_taipei}
                        </span>
                      )}
                      {p.stock_meishu > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-store-meishu)', color: '#fff' }}>
                          美術 {p.stock_meishu}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <BottomNav active="reports" />
    </div>
  );
}
