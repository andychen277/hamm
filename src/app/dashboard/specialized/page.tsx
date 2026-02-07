'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ShipmentItem {
  shipment_id: string;
  cust_po_number: string;
  ship_to: string;
  date_shipped: string;
  shipped_total: number;
  shipped_qty: number;
  tracking_url: string;
}

interface PendingOrderItem {
  order_id: string;
  order_number: string;
  order_status: string;
  total_amount: number;
  submitted_date: string;
}

interface InventoryItem {
  product_id: string;
  product_name: string;
  store: string;
  price: number;
  quantity: number;
}

interface TransitData {
  inventory: InventoryItem[];
  inTransit: ShipmentItem[];
  pendingOrders: PendingOrderItem[];
  lastSync: { sync_type: string; status: string; completed_at: string; records_synced: number } | null;
}

const STORE_COLORS: Record<string, string> = {
  '台南': '#FF6B35',
  '高雄': '#F7C948',
  '台中': '#2EC4B6',
  '台北': '#E71D73',
  '美術': '#9B5DE5',
};

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

export default function SpecializedDashboard() {
  const router = useRouter();
  const [data, setData] = useState<TransitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventory' | 'transit' | 'pending'>('inventory');

  useEffect(() => {
    fetch('/api/specialized/in-transit')
      .then(r => r.json())
      .then(json => {
        if (json.success) setData(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Aggregate inventory by product
  const inventoryByProduct = data?.inventory.reduce((acc, item) => {
    if (!acc[item.product_id]) {
      acc[item.product_id] = {
        product_id: item.product_id,
        product_name: item.product_name,
        price: item.price,
        stores: {} as Record<string, number>,
        total: 0,
      };
    }
    acc[item.product_id].stores[item.store] = item.quantity;
    acc[item.product_id].total += item.quantity;
    return acc;
  }, {} as Record<string, { product_id: string; product_name: string; price: number; stores: Record<string, number>; total: number }>) || {};

  const productList = Object.values(inventoryByProduct).sort((a, b) => b.total - a.total);

  // Summary stats
  const totalProducts = productList.length;
  const totalStock = productList.reduce((sum, p) => sum + p.total, 0);
  const totalInTransit = data?.inTransit.length || 0;
  const totalPending = data?.pendingOrders.length || 0;

  return (
    <div className="pb-20 min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xl">&#8592;</button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Specialized
        </h1>
        {data?.lastSync && (
          <span className="text-[10px] ml-auto px-2 py-0.5 rounded-full"
            style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-muted)' }}>
            {data.lastSync.completed_at}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-60">
          <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : !data ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            無法載入 Specialized 資料
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="px-5 grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-bg-card)' }}>
              <p className="text-lg font-bold" style={{ color: 'var(--color-accent)' }}>{totalStock}</p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>現有庫存</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-bg-card)' }}>
              <p className="text-lg font-bold" style={{ color: 'rgb(147,51,234)' }}>{totalInTransit}</p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>在途出貨</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-bg-card)' }}>
              <p className="text-lg font-bold" style={{ color: 'var(--color-warning)' }}>{totalPending}</p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>待處理單</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-5 flex gap-1 mb-4">
            {[
              { key: 'inventory' as const, label: `庫存 (${totalProducts})` },
              { key: 'transit' as const, label: `在途 (${totalInTransit})` },
              { key: 'pending' as const, label: `待處理 (${totalPending})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: activeTab === tab.key ? 'var(--color-accent)' : 'var(--color-bg-card)',
                  color: activeTab === tab.key ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="px-5">
            {/* Inventory Tab */}
            {activeTab === 'inventory' && (
              <div className="space-y-2">
                {productList.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                    無 Specialized 庫存資料
                  </p>
                ) : productList.map(product => (
                  <div key={product.product_id} className="rounded-xl p-3" style={{ background: 'var(--color-bg-card)' }}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {product.product_name}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {product.product_id} {product.price > 0 && `/ ${fmt$(product.price)}`}
                        </p>
                      </div>
                      <span className="text-sm font-bold tabular-nums shrink-0"
                        style={{ color: product.total > 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                        {product.total}
                      </span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {Object.entries(STORE_COLORS).map(([storeName, color]) => {
                        const qty = product.stores[storeName] || 0;
                        return (
                          <span key={storeName} className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              background: qty > 0 ? color + '22' : 'var(--color-bg-card-alt)',
                              color: qty > 0 ? color : 'var(--color-text-muted)',
                              fontWeight: qty > 0 ? 600 : 400,
                            }}>
                            {storeName} {qty}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* In-Transit Tab */}
            {activeTab === 'transit' && (
              <div className="space-y-2">
                {data.inTransit.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                    目前無在途出貨
                  </p>
                ) : data.inTransit.map(s => (
                  <div key={s.shipment_id} className="rounded-xl p-3" style={{ background: 'var(--color-bg-card)' }}>
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {s.cust_po_number || s.shipment_id}
                      </p>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {s.date_shipped}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      <span>{s.ship_to || '-'}</span>
                      <span>
                        {s.shipped_qty > 0 && `${s.shipped_qty} 件`}
                        {s.shipped_total > 0 && ` / ${fmt$(s.shipped_total)}`}
                      </span>
                    </div>
                    {s.tracking_url && (
                      <a href={s.tracking_url} target="_blank" rel="noreferrer"
                        className="text-[11px] mt-1 inline-block underline"
                        style={{ color: 'var(--color-accent)' }}>
                        追蹤出貨
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pending Orders Tab */}
            {activeTab === 'pending' && (
              <div className="space-y-2">
                {data.pendingOrders.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                    目前無待處理訂單
                  </p>
                ) : data.pendingOrders.map(o => (
                  <div key={o.order_id} className="rounded-xl p-3" style={{ background: 'var(--color-bg-card)' }}>
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {o.order_number}
                      </p>
                      <span className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--color-warning)', color: '#fff' }}>
                        {o.order_status}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      <span>{o.submitted_date}</span>
                      <span className="font-medium">{fmt$(o.total_amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
