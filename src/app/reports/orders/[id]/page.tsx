'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

interface OrderDetail {
  order_id: string;
  store: string;
  order_date: string;
  employee_code: string;
  staff_name: string;
  customer_name: string;
  customer_phone: string;
  product_info: string;
  total_amount: number;
  deposit_paid: number;
  balance: number;
  status: string;
  updated_at: string;
  created_at: string;
  has_line_binding: boolean;
  customer_orders: {
    order_id: string;
    store: string;
    order_date: string;
    status: string;
    product_info: string;
    total_amount: number;
  }[];
  customer_transactions: {
    date: string;
    store: string;
    product_name: string;
    quantity: number;
    total: number;
  }[];
}

const STORE_COLORS: Record<string, string> = {
  '台南': 'var(--color-store-tainan)',
  '高雄': 'var(--color-store-kaohsiung)',
  '台中': 'var(--color-store-taichung)',
  '台北': 'var(--color-store-taipei)',
  '美術': 'var(--color-store-meishu)',
};

const STATUS_COLORS: Record<string, string> = {
  '開單': 'var(--color-warning)',
  '通知': 'var(--color-accent)',
  '結案': 'var(--color-positive)',
  '作廢': 'var(--color-negative)',
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

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = decodeURIComponent(params.id as string);
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editProduct, setEditProduct] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDeposit, setEditDeposit] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  // Notification state
  const [showNotifyPanel, setShowNotifyPanel] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/reports/orders/${encodeURIComponent(orderId)}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [orderId]);

  const handleNotify = async () => {
    if (!data) return;

    setNotifying(true);
    setNotifyResult(null);

    try {
      const res = await fetch('/api/notify/line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'order_arrived',
          phone: data.customer_phone,
          orderId: data.order_id,
          customMessage: notifyMessage.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setNotifyResult({ success: true, message: '通知已發送至客戶 LINE，狀態已更新為「通知」' });
        setShowNotifyPanel(false);
        setNotifyMessage('');
        // Update local state to reflect status change
        setData(prev => prev ? { ...prev, status: '通知' } : null);
      } else {
        setNotifyResult({
          success: false,
          message: json.notBound ? '此客戶尚未綁定 LINE' : (json.error || '發送失敗'),
        });
      }
    } catch {
      setNotifyResult({ success: false, message: '發送失敗，請稍後再試' });
    } finally {
      setNotifying(false);
    }
  };

  const startEdit = () => {
    if (!data) return;
    setEditProduct(data.product_info);
    setEditAmount(String(data.total_amount));
    setEditDeposit(String(data.deposit_paid));
    setEditing(true);
    setSaveResult(null);
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setSaveResult(null);

    try {
      const res = await fetch(`/api/reports/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_info: editProduct,
          total_amount: Number(editAmount) || 0,
          deposit_paid: Number(editDeposit) || 0,
        }),
      });

      const json = await res.json();

      if (json.success) {
        // Re-fetch from server to verify persistence
        try {
          const verifyRes = await fetch(`/api/reports/orders/${encodeURIComponent(orderId)}`);
          const verifyJson = await verifyRes.json();
          if (verifyJson.success) {
            setData(verifyJson.data);
          }
        } catch {
          // Fallback to local state update
          const newAmount = Number(editAmount) || 0;
          const newDeposit = Number(editDeposit) || 0;
          setData(prev => prev ? {
            ...prev,
            product_info: editProduct,
            total_amount: newAmount,
            deposit_paid: newDeposit,
            balance: newAmount - newDeposit,
          } : null);
        }
        setEditing(false);
        setSaveResult({ success: true, message: '已儲存修改' });
      } else {
        setSaveResult({ success: false, message: json.error || '儲存失敗' });
      }
    } catch {
      setSaveResult({ success: false, message: '儲存失敗' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-lg font-bold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          客訂詳情
        </h1>
        {data && !editing && (
          <button
            onClick={startEdit}
            className="text-sm px-3 py-1 rounded-lg"
            style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-accent)' }}
          >
            編輯
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : !data ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>找不到客訂資料</p>
        </div>
      ) : (
        <div className="px-5">
          {/* Save Result */}
          {saveResult && (
            <div
              className="rounded-xl p-3 mb-3 text-sm"
              style={{
                background: saveResult.success ? 'var(--color-positive)' : 'var(--color-negative)',
                color: '#fff',
              }}
            >
              {saveResult.success ? '✓' : '✗'} {saveResult.message}
            </div>
          )}

          {/* Notify Result */}
          {notifyResult && (
            <div
              className="rounded-xl p-3 mb-3 text-sm"
              style={{
                background: notifyResult.success ? 'var(--color-positive)' : 'var(--color-negative)',
                color: '#fff',
              }}
            >
              {notifyResult.success ? '✓' : '✗'} {notifyResult.message}
            </div>
          )}

          {/* Order Header */}
          <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-muted)' }}>
                {data.order_id}
              </span>
              <span
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ background: STORE_COLORS[data.store] || 'var(--color-accent)', color: '#fff' }}
              >
                {data.store}
              </span>
              <span
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ background: STATUS_COLORS[data.status] || 'var(--color-text-muted)', color: '#fff' }}
              >
                {data.status}
              </span>
            </div>
            {data.staff_name && (
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                開單人員: {data.staff_name}
              </p>
            )}
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              開單日期: {data.order_date}
            </p>
            {data.updated_at && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                最後更新: {data.updated_at}
              </p>
            )}
          </div>

          {/* Customer Info */}
          <Card title="👤 客戶資訊">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>姓名</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {data.customer_name || '(無姓名)'}
                </span>
              </div>
              {data.customer_phone && (
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>電話</span>
                  <a
                    href={`tel:${data.customer_phone}`}
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    {data.customer_phone}
                  </a>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>LINE 綁定</span>
                <span className="text-sm" style={{ color: data.has_line_binding ? 'var(--color-positive)' : 'var(--color-text-muted)' }}>
                  {data.has_line_binding ? '已綁定' : '未綁定'}
                </span>
              </div>
            </div>
          </Card>

          {/* Product Info */}
          <Card title="📦 商品資訊">
            {editing ? (
              <textarea
                value={editProduct}
                onChange={e => setEditProduct(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                placeholder="輸入商品資訊..."
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                {data.product_info || '(無商品資訊)'}
              </p>
            )}
          </Card>

          {/* Payment Info */}
          <Card title="💰 金額資訊">
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>總金額</label>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>已付訂金</label>
                  <input
                    type="number"
                    value={editDeposit}
                    onChange={e => setEditDeposit(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                  />
                </div>
                <div className="flex justify-between text-sm pt-2 border-t" style={{ borderColor: 'var(--color-bg-card-alt)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>尾款</span>
                  <span className="font-bold" style={{ color: 'var(--color-warning)' }}>
                    {fmt$((Number(editAmount) || 0) - (Number(editDeposit) || 0))}
                  </span>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setEditing(false); setSaveResult(null); }}
                    className="flex-1 py-2 rounded-lg text-sm font-medium"
                    style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-muted)' }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ background: 'var(--color-accent)', color: '#fff' }}
                  >
                    {saving ? '儲存中...' : '儲存修改'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>總金額</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {fmt$(data.total_amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>已付訂金</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--color-positive)' }}>
                    {fmt$(data.deposit_paid)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>尾款</span>
                  <span className="text-sm font-bold" style={{ color: data.balance > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                    {fmt$(data.balance)}
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* Notify Button */}
          {data.customer_phone && (
            <div className="mb-3">
              <button
                onClick={() => setShowNotifyPanel(!showNotifyPanel)}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-opacity"
                style={{ background: 'var(--color-positive)', color: '#fff' }}
              >
                📢 到貨通知
              </button>
            </div>
          )}

          {/* Notify Panel */}
          {showNotifyPanel && (
            <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--color-bg-card)' }}>
              <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                發送到貨通知
              </h3>

              {!data.has_line_binding && (
                <div className="p-3 rounded-lg mb-3 text-xs" style={{ background: 'var(--color-warning)', color: '#fff' }}>
                  此客戶尚未綁定 LINE，通知可能無法送達
                </div>
              )}

              <div className="mb-3">
                <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                  自訂訊息（選填）
                </label>
                <textarea
                  value={notifyMessage}
                  onChange={e => setNotifyMessage(e.target.value)}
                  placeholder="您好！您的客訂商品已到貨，歡迎來店取貨。"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                />
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  留空則使用預設訊息，內容會包含商品及金額資訊
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowNotifyPanel(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-muted)' }}
                >
                  取消
                </button>
                <button
                  onClick={handleNotify}
                  disabled={notifying}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--color-positive)', color: '#fff' }}
                >
                  {notifying ? '發送中...' : '發送通知'}
                </button>
              </div>
            </div>
          )}

          {/* Customer's Other Orders */}
          {data.customer_orders.length > 0 && (
            <Card title="📦 此客戶其他客訂">
              <div className="space-y-2">
                {data.customer_orders.map((o, i) => (
                  <Link
                    key={i}
                    href={`/reports/orders/${encodeURIComponent(o.order_id)}`}
                    className="block py-2 border-b last:border-b-0"
                    style={{ borderColor: 'var(--color-bg-card-alt)' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{o.order_date}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: STORE_COLORS[o.store] || 'var(--color-accent)', color: '#fff' }}
                      >
                        {o.store}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: STATUS_COLORS[o.status] || 'var(--color-text-muted)', color: '#fff' }}
                      >
                        {o.status}
                      </span>
                      <span className="ml-auto text-xs tabular-nums" style={{ color: 'var(--color-positive)' }}>
                        {fmt$(o.total_amount)}
                      </span>
                    </div>
                    {o.product_info && (
                      <p className="text-xs line-clamp-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {o.product_info}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Customer's Recent Transactions */}
          {data.customer_transactions.length > 0 && (
            <Card title="🛒 此客戶近期消費">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.customer_transactions.map((tx, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg"
                    style={{ background: 'var(--color-bg-card-alt)' }}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <span className="text-xs font-medium flex-1 line-clamp-2" style={{ color: 'var(--color-text-primary)' }}>
                        {tx.product_name || '(無商品名)'}
                      </span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-positive)' }}>
                        {fmt$(tx.total)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                      <span>{tx.date}</span>
                      <span>×{tx.quantity}</span>
                      <span
                        className="px-1 py-0.5 rounded"
                        style={{ background: STORE_COLORS[tx.store] || 'var(--color-accent)', color: '#fff' }}
                      >
                        {tx.store}
                      </span>
                    </div>
                  </div>
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
