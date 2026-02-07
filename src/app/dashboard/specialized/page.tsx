'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface ShipmentItem {
  id: number;
  shipment_id: string;
  cust_po_number: string;
  ship_to: string;
  date_shipped: string;
  shipped_total: number;
  shipped_qty: number;
  tracking_url: string;
  store: string;
}

interface PendingOrderItem {
  id: number;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SearchResult = Record<string, any>;

const STORE_COLORS: Record<string, string> = {
  '台南': '#FF6B35',
  '高雄': '#F7C948',
  '台中': '#2EC4B6',
  '台北': '#E71D73',
  '美術': '#9B5DE5',
};

const STORE_OPTIONS = ['台南', '高雄', '美術', '台中', '台北', '崇明'];

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

export default function SpecializedDashboard() {
  const router = useRouter();
  const [data, setData] = useState<TransitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventory' | 'transit' | 'pending'>('inventory');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'shipments' | 'orders' | 'pending'>('shipments');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Confirm receipt state
  const [confirmModal, setConfirmModal] = useState<ShipmentItem | null>(null);
  const [confirmStore, setConfirmStore] = useState('台南');
  const [confirming, setConfirming] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');

  // Store filter state (for transit tab)
  const [storeFilter, setStoreFilter] = useState<string>('all');

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/specialized/in-transit')
      .then(r => r.json())
      .then(json => {
        if (json.success) setData(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Search handler
  const handleSearch = useCallback(async () => {
    if (!searchQuery && !dateFrom && !dateTo) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({ type: searchType });
      if (searchQuery) params.set('q', searchQuery);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const res = await fetch(`/api/specialized/search?${params}`);
      const json = await res.json();
      if (json.success) {
        setSearchResults(json.data);
      }
    } catch { /* ignore */ }
    finally { setSearching(false); }
  }, [searchQuery, searchType, dateFrom, dateTo]);

  const clearSearch = () => {
    setSearchResults(null);
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  };

  const setQuickDate = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateFrom(start.toISOString().split('T')[0]);
    setDateTo(end.toISOString().split('T')[0]);
  };

  // Confirm receipt handler
  const handleConfirmReceive = async () => {
    if (!confirmModal || confirming) return;
    setConfirming(true);
    setConfirmMsg('');
    try {
      const res = await fetch('/api/specialized/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipment_id: confirmModal.shipment_id, store: confirmStore }),
      });
      const json = await res.json();
      if (json.success) {
        setConfirmMsg(`收貨成功！單號: ${json.data.order_no}`);
        // Remove from in-transit list
        if (data) {
          setData({
            ...data,
            inTransit: data.inTransit.filter(s => s.shipment_id !== confirmModal.shipment_id),
          });
        }
        setTimeout(() => setConfirmModal(null), 1500);
      } else {
        setConfirmMsg(`錯誤: ${json.error}`);
      }
    } catch {
      setConfirmMsg('網路錯誤，請重試');
    } finally {
      setConfirming(false);
    }
  };

  // B2B Sync handler
  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/specialized/b2b-sync', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        setSyncResult(`同步完成: ${d.shipments} 出貨 + ${d.orders} 訂單 (${(d.duration_ms / 1000).toFixed(1)}s)`);
        // Reload data
        const dataRes = await fetch('/api/specialized/in-transit');
        const dataJson = await dataRes.json();
        if (dataJson.success) setData(dataJson.data);
      } else {
        setSyncResult(`同步失敗: ${json.error}`);
      }
    } catch {
      setSyncResult('網路錯誤，請重試');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

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
        <div className="ml-auto flex items-center gap-2">
          {data?.lastSync && (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-muted)' }}>
              {data.lastSync.completed_at}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="h-8 px-3 rounded-lg flex items-center justify-center text-[11px] font-medium"
            style={{
              background: syncing ? 'var(--color-bg-card-alt)' : 'var(--color-accent)',
              color: '#fff',
              opacity: syncing ? 0.7 : 1,
            }}
          >
            {syncing ? 'Syncing...' : 'Sync B2B'}
          </button>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
            style={{
              background: showSearch ? 'var(--color-accent)' : 'var(--color-bg-card)',
              color: showSearch ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            &#128269;
          </button>
        </div>
      </div>

      {/* Sync Result Banner */}
      {syncResult && (
        <div className="mx-5 mb-2 px-3 py-2 rounded-xl text-xs"
          style={{
            background: syncResult.startsWith('同步完成') ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: syncResult.startsWith('同步完成') ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
          }}>
          {syncResult}
        </div>
      )}

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
          {/* Search Panel */}
          {showSearch && (
            <div className="px-5 mb-4 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="搜尋 Shipment ID / PO / Order..."
                  className="flex-1 h-10 px-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-bg-card-alt)' }}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="px-4 h-10 rounded-xl text-sm font-medium shrink-0"
                  style={{ background: 'var(--color-accent)', color: '#fff', opacity: searching ? 0.6 : 1 }}
                >
                  {searching ? '...' : '搜尋'}
                </button>
              </div>

              {/* Search type */}
              <div className="flex gap-1">
                {[
                  { key: 'shipments' as const, label: '出貨' },
                  { key: 'orders' as const, label: '訂單' },
                  { key: 'pending' as const, label: '待處理' },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setSearchType(t.key)}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-medium"
                    style={{
                      background: searchType === t.key ? 'var(--color-accent)' : 'var(--color-bg-card)',
                      color: searchType === t.key ? '#fff' : 'var(--color-text-muted)',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Date range */}
              <div className="flex gap-2">
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="flex-1 h-9 px-2 rounded-lg text-xs outline-none"
                  style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-bg-card-alt)' }} />
                <span className="self-center text-xs" style={{ color: 'var(--color-text-muted)' }}>~</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="flex-1 h-9 px-2 rounded-lg text-xs outline-none"
                  style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-bg-card-alt)' }} />
              </div>

              {/* Quick date presets */}
              <div className="flex gap-2">
                {[
                  { label: '7天', days: 7 },
                  { label: '30天', days: 30 },
                  { label: '90天', days: 90 },
                ].map(p => (
                  <button key={p.days} onClick={() => setQuickDate(p.days)}
                    className="px-3 py-1 rounded-lg text-[11px]"
                    style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)' }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchResults !== null ? (
            <div className="px-5">
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  搜尋結果: {searchResults.length} 筆
                </p>
                <button onClick={clearSearch} className="text-xs underline"
                  style={{ color: 'var(--color-accent)' }}>
                  清除搜尋
                </button>
              </div>
              <div className="space-y-2">
                {searchResults.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                    無符合條件的記錄
                  </p>
                ) : searchResults.map((item, i) => (
                  <div key={item.id || i}
                    onClick={() => {
                      if (searchType === 'shipments') {
                        router.push(`/dashboard/specialized/shipment/${item.id}`);
                      } else {
                        router.push(`/dashboard/specialized/order/${item.id}`);
                      }
                    }}
                    className="rounded-xl p-3 cursor-pointer active:opacity-80"
                    style={{ background: 'var(--color-bg-card)' }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {item.shipment_id || item.order_number || item.order_id}
                      </p>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {item.date_shipped || item.order_date || item.submitted_date}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      <span>{item.cust_po_number || item.ship_to || item.order_status || '-'}</span>
                      <span className="font-medium">
                        {item.shipped_total ? fmt$(item.shipped_total) : item.total_amount ? fmt$(item.total_amount) : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
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
                {activeTab === 'transit' && (() => {
                  const filteredTransit = storeFilter === 'all'
                    ? data.inTransit
                    : data.inTransit.filter(s => s.store === storeFilter);

                  // Count per store for tab badges
                  const storeCounts: Record<string, number> = {};
                  for (const s of data.inTransit) {
                    if (s.store) storeCounts[s.store] = (storeCounts[s.store] || 0) + 1;
                  }

                  return (
                  <div className="space-y-2">
                    {/* Store Filter Tabs */}
                    <div className="flex gap-1 mb-3 overflow-x-auto">
                      <button
                        onClick={() => setStoreFilter('all')}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap"
                        style={{
                          background: storeFilter === 'all' ? 'var(--color-text-primary)' : 'var(--color-bg-card)',
                          color: storeFilter === 'all' ? 'var(--color-bg-primary)' : 'var(--color-text-muted)',
                        }}
                      >
                        全部 ({data.inTransit.length})
                      </button>
                      {['台南', '台北', '台中', '高雄'].map(store => (
                        <button
                          key={store}
                          onClick={() => setStoreFilter(store)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap"
                          style={{
                            background: storeFilter === store ? (STORE_COLORS[store] || 'var(--color-accent)') : 'var(--color-bg-card)',
                            color: storeFilter === store ? '#fff' : 'var(--color-text-muted)',
                          }}
                        >
                          {store} ({storeCounts[store] || 0})
                        </button>
                      ))}
                    </div>

                    {filteredTransit.length === 0 ? (
                      <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                        {storeFilter === 'all' ? '目前無在途出貨' : `${storeFilter} 目前無在途出貨`}
                      </p>
                    ) : filteredTransit.map(s => (
                      <div key={s.shipment_id} className="rounded-xl p-3" style={{ background: 'var(--color-bg-card)' }}>
                        <div
                          onClick={() => router.push(`/dashboard/specialized/shipment/${s.id}`)}
                          className="cursor-pointer active:opacity-80"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-1.5">
                              {s.store && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                                  style={{
                                    background: (STORE_COLORS[s.store] || 'var(--color-accent)') + '22',
                                    color: STORE_COLORS[s.store] || 'var(--color-accent)',
                                  }}>
                                  {s.store}
                                </span>
                              )}
                              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                {s.cust_po_number || s.shipment_id}
                              </p>
                            </div>
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
                              onClick={e => e.stopPropagation()}
                              className="text-[11px] mt-1 inline-block underline"
                              style={{ color: 'var(--color-accent)' }}>
                              追蹤出貨
                            </a>
                          )}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmModal(s); setConfirmMsg(''); }}
                          className="mt-2 w-full py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: 'rgba(34,197,94,0.15)', color: 'rgb(34,197,94)', border: '1px solid rgba(34,197,94,0.3)' }}
                        >
                          確認收貨
                        </button>
                      </div>
                    ))}
                  </div>
                  );
                })()}

                {/* Pending Orders Tab */}
                {activeTab === 'pending' && (
                  <div className="space-y-2">
                    {data.pendingOrders.length === 0 ? (
                      <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                        目前無待處理訂單
                      </p>
                    ) : data.pendingOrders.map(o => (
                      <div key={o.order_id}
                        onClick={() => router.push(`/dashboard/specialized/order/${o.id}`)}
                        className="rounded-xl p-3 cursor-pointer active:opacity-80"
                        style={{ background: 'var(--color-bg-card)' }}
                      >
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
        </>
      )}

      {/* Confirm Receipt Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => !confirming && setConfirmModal(null)}
        >
          <div className="w-full max-w-lg rounded-t-2xl p-5 pb-8"
            style={{ background: 'var(--color-bg-primary)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              確認收貨
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
              {confirmModal.cust_po_number || confirmModal.shipment_id}
              {confirmModal.shipped_qty > 0 && ` / ${confirmModal.shipped_qty} 件`}
              {confirmModal.shipped_total > 0 && ` / ${fmt$(confirmModal.shipped_total)}`}
            </p>

            <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>
              收貨門市
            </label>
            <select
              value={confirmStore}
              onChange={e => setConfirmStore(e.target.value)}
              className="w-full h-11 px-3 rounded-xl text-sm outline-none mb-4"
              style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-bg-card-alt)' }}
            >
              {STORE_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {confirmMsg && (
              <p className="text-xs mb-3" style={{
                color: confirmMsg.startsWith('錯誤') || confirmMsg.startsWith('網路') ? 'var(--color-negative)' : 'var(--color-positive)',
              }}>
                {confirmMsg}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                disabled={confirming}
                className="flex-1 h-11 rounded-xl text-sm font-medium"
                style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)' }}
              >
                取消
              </button>
              <button
                onClick={handleConfirmReceive}
                disabled={confirming}
                className="flex-1 h-11 rounded-xl text-sm font-medium"
                style={{ background: 'rgb(34,197,94)', color: '#fff', opacity: confirming ? 0.6 : 1 }}
              >
                {confirming ? '處理中...' : '確認收貨'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
