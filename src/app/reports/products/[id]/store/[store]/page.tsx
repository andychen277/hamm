'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

interface OrderProduct {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

interface Order {
  order_number: string;
  date: string;
  member_name: string;
  member_phone: string;
  this_product: {
    quantity: number;
    price: number;
    total: number;
  };
  all_products: OrderProduct[];
  order_total: number;
}

interface StoreSalesData {
  product_id: string;
  product_name: string;
  store: string;
  summary: {
    total_revenue: number;
    total_qty: number;
    order_count: number;
  };
  orders: Order[];
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

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function StoreSalesPage() {
  const params = useParams();
  const router = useRouter();
  const productId = decodeURIComponent(params.id as string);
  const store = decodeURIComponent(params.store as string);
  const [data, setData] = useState<StoreSalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/reports/products/${encodeURIComponent(productId)}/store/${encodeURIComponent(store)}`);
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [productId, store]);

  const toggleOrder = (orderNumber: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderNumber)) {
        next.delete(orderNumber);
      } else {
        next.add(orderNumber);
      }
      return next;
    });
  };

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-lg font-bold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          {store}門市銷售明細
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : !data ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>找不到銷售資料</p>
        </div>
      ) : (
        <div className="px-5">
          {/* Product Info */}
          <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: STORE_COLORS[data.store] || '#64748b' }}
              />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {data.store}門市
              </span>
            </div>
            <h2 className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              {data.product_name}
            </h2>
            <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
              {data.product_id}
            </p>
          </div>

          {/* Summary */}
          <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
                  {fmt$(data.summary.total_revenue)}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>總營收</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>
                  {data.summary.total_qty}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>總數量</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                  {data.summary.order_count}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>訂單數</p>
              </div>
            </div>
          </div>

          {/* Orders List */}
          <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
            <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              📋 訂單明細（近90天）
            </h3>

            {data.orders.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>無訂單資料</p>
            ) : (
              <div className="space-y-3">
                {data.orders.map((order, i) => {
                  const isExpanded = expandedOrders.has(order.order_number);
                  const otherProducts = order.all_products.filter(p => p.product_id !== productId);

                  return (
                    <div
                      key={`${order.order_number}-${i}`}
                      className="border-b pb-3 last:border-b-0 last:pb-0"
                      style={{ borderColor: 'var(--color-bg-card-alt)' }}
                    >
                      {/* Order Header - Clickable */}
                      <button
                        onClick={() => toggleOrder(order.order_number)}
                        className="w-full text-left"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {formatDate(order.date)}
                            </span>
                            <span className="text-xs font-mono ml-2" style={{ color: 'var(--color-text-muted)' }}>
                              {order.order_number?.slice(-8) || '-'}
                            </span>
                          </div>
                          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
                            {fmt$(order.this_product.total)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                              {order.member_name}
                            </span>
                            {order.member_phone && (
                              <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
                                {order.member_phone}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {order.this_product.quantity}件
                            </span>
                            {otherProducts.length > 0 && (
                              <span className="text-xs" style={{ color: 'var(--color-accent)' }}>
                                +{otherProducts.length}項 {isExpanded ? '▲' : '▼'}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Expanded: Other products in this order */}
                      {isExpanded && otherProducts.length > 0 && (
                        <div className="mt-2 ml-2 pl-2 border-l-2" style={{ borderColor: 'var(--color-bg-card-alt)' }}>
                          <p className="text-[11px] mb-1" style={{ color: 'var(--color-text-muted)' }}>
                            同訂單其他商品:
                          </p>
                          {otherProducts.map((p, j) => (
                            <Link
                              key={j}
                              href={`/reports/products/${encodeURIComponent(p.product_id)}`}
                              className="flex justify-between items-center py-1 text-xs active:bg-white/5"
                            >
                              <span className="flex-1 mr-2 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                {p.product_name}
                              </span>
                              <span className="tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                                {p.quantity}x {fmt$(p.price)}
                              </span>
                            </Link>
                          ))}
                          <div className="flex justify-between items-center pt-1 mt-1 border-t" style={{ borderColor: 'var(--color-bg-card-alt)' }}>
                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>訂單總計</span>
                            <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                              {fmt$(order.order_total)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav active="reports" />
    </div>
  );
}
