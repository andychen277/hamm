'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STORES = ['all', '台南', '高雄', '美術', '台中', '台北'];

interface TransferOrder {
  id: number;
  order_no: string;
  staff_name: string;
  from_store: string;
  to_store: string;
  logistics: string;
  tracking_no: string;
  total_items: number;
  total_qty: number;
  status: string;
  note: string;
  created_at: string;
}

interface TransferItem {
  id: number;
  product_id: string;
  product_name: string;
  barcode: string;
  price: number;
  quantity: number;
}

interface TransferDetail extends TransferOrder {
  items: TransferItem[];
}

export default function TransferHistoryPage() {
  const [orders, setOrders] = useState<TransferOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<TransferDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchOrders = async (storeFilter: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: '30' });
      if (storeFilter !== 'all') params.set('store', storeFilter);
      const res = await fetch(`/api/transfer?${params}`);
      const json = await res.json();
      if (json.success) setOrders(json.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(store); }, [store]);

  const viewDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/transfer/${id}`);
      const json = await res.json();
      if (json.success) setSelectedOrder(json.data);
    } catch { /* ignore */ }
    finally { setDetailLoading(false); }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (selectedOrder) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex items-center gap-3 px-4 py-3"
          style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}>
          <button onClick={() => setSelectedOrder(null)} className="text-sm" style={{ color: 'var(--color-accent)' }}>
            &#8592; 返回
          </button>
          <h1 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>調貨單詳情</h1>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>單號</span>
                <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{selectedOrder.order_no}</p>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>時間</span>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{formatDate(selectedOrder.created_at)}</p>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>調出</span>
                <p className="text-xs mt-0.5 font-semibold" style={{ color: 'var(--color-text-primary)' }}>{selectedOrder.from_store}</p>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>調入</span>
                <p className="text-xs mt-0.5 font-semibold" style={{ color: 'var(--color-text-primary)' }}>{selectedOrder.to_store}</p>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>經手人</span>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{selectedOrder.staff_name}</p>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>統計</span>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                  {selectedOrder.total_items} 項 / {selectedOrder.total_qty} 件
                </p>
              </div>
              {selectedOrder.logistics && (
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>物流</span>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{selectedOrder.logistics}</p>
                </div>
              )}
              {selectedOrder.tracking_no && (
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>追蹤號</span>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{selectedOrder.tracking_no}</p>
                </div>
              )}
            </div>
            {selectedOrder.note && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>備註：{selectedOrder.note}</p>
              </div>
            )}
          </div>

          {/* Print shipping label */}
          <Link
            href={`/transfer/${selectedOrder.id}/shipping`}
            className="block w-full py-3 rounded-xl text-sm font-semibold text-center"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            列印寄貨單
          </Link>

          {/* Items */}
          <div>
            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>商品明細</h3>
            <div className="space-y-2">
              {selectedOrder.items.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'var(--color-bg-card)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{item.product_name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {item.product_id}{item.price > 0 && ` / $${item.price.toLocaleString()}`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold px-3" style={{ color: 'var(--color-text-primary)' }}>x{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <div className="flex items-center gap-3 px-4 py-3"
        style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}>
        <Link href="/transfer" className="text-sm" style={{ color: 'var(--color-accent)' }}>&#8592; 掃描</Link>
        <h1 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Alien 調貨紀錄</h1>
      </div>

      <div className="flex gap-2 px-4 py-3 overflow-x-auto">
        {STORES.map(s => (
          <button
            key={s}
            onClick={() => setStore(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
            style={{
              background: store === s ? 'var(--color-accent)' : 'var(--color-bg-card)',
              color: store === s ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            {s === 'all' ? '全部' : s}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-2 pb-8">
        {loading ? (
          <div className="text-center py-10">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>最近 30 天無調貨紀錄</p>
          </div>
        ) : (
          orders.map(order => (
            <button
              key={order.id}
              onClick={() => viewDetail(order.id)}
              className="w-full text-left p-4 rounded-xl"
              style={{ background: 'var(--color-bg-card)' }}
              disabled={detailLoading}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {order.from_store} → {order.to_store}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{formatDate(order.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {order.staff_name} - {order.total_items} 項 / {order.total_qty} 件
                  {order.logistics ? ` (${order.logistics})` : ''}
                </span>
                <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{order.order_no}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
